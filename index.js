const express = require('express')
const app = express()
require('dotenv').config()
const port = process.env.PORT || 3000;
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
// MiddleWare 
app.use(express.json());
app.use(cors());

// connection string 
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.BD_PASSWORD}@simple-crud-server.30cfyeq.mongodb.net/?appName=simple-crud-server`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const db = client.db("Simple-Project");
        const coursesCollection = db.collection("courses");
        const userCollection = db.collection("users");

        // user related api 
        // User Related api
        app.get('/users', async (req, res) => {
            const searchText = req.query.searchText;
            const query = {};
            if (searchText) {
                // query.displayName = {$regex: searchText, $options: 'i'}
                query.$or = [
                    { displayName: { $regex: searchText, $options: 'i' } },
                    { email: { $regex: searchText, $options: 'i' } }
                ]
            }
            const cursor = userCollection.find(query).sort({ createAt: -1 }).limit(5);
            const result = await cursor.toArray();
            res.send(result)
        })

        app.get('/users/:email/role', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const user = await userCollection.findOne(query);
            res.send({ role: user?.role || 'user ' })
        })

        app.patch('/users/:id/role',
            //  verifyFirebaseToken, verifyAdmin, 
            async (req, res) => {
                const id = req.params.id;
                const roleInfo = req.body;
                const query = { _id: new ObjectId(id) };
                const updateDoc = {
                    $set: {
                        role: roleInfo.role
                    }
                }
                const result = await userCollection.updateOne(query, updateDoc);
                res.send(result);
            })

        app.post('/users', async (req, res) => {
            const user = req.body;
            user.role = "user";
            user.createAt = new Date();

            const email = user.email;
            const userExists = await userCollection.findOne({ email });

            if (userExists) {
                return res.send({ message: 'user already exists' });
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        })

        // courses api 

        app.get('/courses', async (req, res) => {
            try {
                const result = await coursesCollection
                    .find()
                    .toArray();

                res.send(result);
            } catch (error) {
                res.status(500).send({ message: "Failed to fetch courses", error });
            }
        });

        const allowedCourseFields = {
            title: { type: "string", required: true },
            description: { type: "string", required: true },
            rating: { type: "number", required: true, min: 0, max: 5 },
            price: { type: "number", required: true, min: 0 },
            is_published: { type: "boolean", required: true }
        };
        app.post('/courses', async (req, res) => {
            try {
                const course = req.body;
                const errors = [];

                // 1️⃣ Validate each field
                for (const field in allowedCourseFields) {
                    const rules = allowedCourseFields[field];
                    const value = course[field];

                    // Required field missing
                    if (rules.required && (value === undefined || value === null)) {
                        errors.push({ field, error: "Field is required" });
                        continue;
                    }

                    // Skip validation if field optional & not provided
                    if (value === undefined) continue;

                    // Type check
                    if (rules.type === "string" && typeof value !== "string") {
                        errors.push({ field, error: `Expected string, got ${typeof value}` });
                    }
                    if (rules.type === "number" && typeof value !== "number") {
                        errors.push({ field, error: `Expected number, got ${typeof value}` });
                    }
                    if (rules.type === "boolean" && typeof value !== "boolean") {
                        errors.push({ field, error: `Expected boolean, got ${typeof value}` });
                    }

                    // Extra checks: min/max for number
                    if (rules.type === "number") {
                        if (rules.min !== undefined && value < rules.min) {
                            errors.push({ field, error: `Value must be >= ${rules.min}` });
                        }
                        if (rules.max !== undefined && value > rules.max) {
                            errors.push({ field, error: `Value must be <= ${rules.max}` });
                        }
                    }
                }

                // 2️⃣ Check for invalid extra fields
                for (const field in course) {
                    if (!allowedCourseFields[field]) {
                        errors.push({ field, error: "Field not allowed" });
                    }
                }

                // 3️⃣ If any errors → return 400
                if (errors.length > 0) {
                    return res.status(400).send({ message: "Validation failed", errors });
                }

                // 4️⃣ All valid → insert into DB
                const result = await coursesCollection.insertOne(course);
                res.status(201).send({ message: "Course created successfully", courseId: result.insertedId });

            } catch (error) {
                console.error(error);
                res.status(500).send({ message: "Internal server error" });
            }
        });

        const allowedUpdates = {
            title: "string",
            description: "string",
            rating: "number",
            price: "number",
            is_published: "boolean"
        };
        app.patch("/courses/:id", async (req, res) => {
            try {
                const id = req.params.id;
                const updateData = req.body;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({ message: "Invalid course ID" });
                }

                // 1️⃣ Validate course exists
                const course = await coursesCollection.findOne({ _id: new ObjectId(id) });
                if (!course) {
                    return res.status(404).send({ message: "Course not found" });
                }

                // 2️⃣ Validate all fields before updating
                const invalidFields = [];

                for (const key in updateData) {
                    if (!allowedUpdates[key]) {
                        invalidFields.push({ field: key, error: "Field not allowed" });
                    } else {
                        const expectedType = allowedUpdates[key];
                        const value = updateData[key];
                        if (expectedType === "number" && typeof value !== "number") {
                            invalidFields.push({ field: key, error: `Expected number, got ${typeof value}` });
                        }
                        if (expectedType === "string" && typeof value !== "string") {
                            invalidFields.push({ field: key, error: `Expected string, got ${typeof value}` });
                        }
                        if (expectedType === "boolean" && typeof value !== "boolean") {
                            invalidFields.push({ field: key, error: `Expected boolean, got ${typeof value}` });
                        }
                    }
                }

                // 3️⃣ If any invalid field → abort
                if (invalidFields.length > 0) {
                    return res.status(400).send({
                        message: "Validation failed",
                        errors: invalidFields
                    });
                }

                // 4️⃣ All fields valid → proceed with update
                await coursesCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updateData }
                );

                const updatedCourse = await coursesCollection.findOne({ _id: new ObjectId(id) });
                res.status(200).send({ message: "Course updated successfully", course: updatedCourse });

            } catch (error) {
                console.error(error);
                res.status(500).send({ message: "Internal server error" });
            }
        });


        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Simple react projects setup is running!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})

