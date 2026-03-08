const express = require('express')
const app = express()
require('dotenv').config()
const port = process.env.PORT || 3000;
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
// MiddleWare 
app.use(express.json());
app.use(cors());


// course er image er jonno multer sue kore 

const multer = require("multer");
const path = require("path");

// Multer Storage Setup
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/");
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    },
});

const upload = multer({ storage });

// Create uploads folder if not exists
const fs = require("fs");
if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads");
}

// Serve images statically
app.use("/uploads", express.static("uploads"));




// middleware VerifyFirebaseToken

// const verifyFirebaseToken = async (req, res, next) => {
//     // console.log('headers in the middleware',req.headers?.authorization)
//     const token = req.headers.authorization;

//     if (!token) {
//         return res.status(401).send({ message: 'unauthorized access' })
//     }

//     try {
//         const idToken = token.split(' ')[1];
//         const decoded = await admin.auth().verifyIdToken(idToken);
//         // console.log('decoded in the token', decoded);
//         req.decoded_email = decoded.email;

//         next();
//     }
//     catch (err) {
//         return res.status(401).send({ message: 'unauthorized access' })
//     }

// }



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
        const countersCourseCollection = db.collection("course-counters");


        // middleware admin before allowing admin activity
        // mst be used after verifyFirebaseToken middleware
        // const verifyAdmin = async (req, res, next) => {
        //     const email = req.decoded_email;
        //     const query = { email };
        //     const user = await userCollection.findOne(query);

        //     if (!user || user.role !== 'admin') {
        //         return res.status(403).send({ message: 'forbidden access' });
        //     }

        //     next();
        // }

        // user related api 
        // User Related api





        app.get('/users', async (req, res) => {
            try {
                const searchText = req.query.searchText;
                const role = req.query.role;
                const sortOrder = req.query.sort; // latest / oldest
                const categoryRole = req.query.categoryRole; // all cateroy

                const query = {};

                // Role filter
                if (role) {
                    query.role = role;
                }

                // Category filter
                if (categoryRole && categoryRole !== "all") {
                    query.categoryRole = categoryRole;
                }

                // Search filter (conditional)
                if (searchText) {
                    query.$or = [
                        { displayName: { $regex: searchText, $options: "i" } },
                        { email: { $regex: searchText, $options: "i" } },
                    ];
                }
                // Dynamic Sort
                let sort = {};

                // Admin Dashboard → date sort
                if (sortOrder) {
                    sort.createAt = sortOrder === "latest" ? -1 : 1;
                }


                // Instructor page → category sort
                if (!sortOrder && categoryRole) {
                    sort.categoryRole = 1;
                }

                const result = await userCollection
                    .find(query)
                    .sort(sort)
                    .toArray();

                res.send(result);

            } catch (error) {
                console.error(error);
                res.status(500).send({ message: "Failed to fetch users" });
            }
        });


        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const { fields } = req.query;

            if (!email) {
                return res.status(400).send({
                    success: false,
                    message: "Email is required"
                });
            }
            const user = await userCollection.findOne({ email });
            if (!user) {
                return res.status(404).send({
                    success: false,
                    message: "User not found"
                });
            }
            // যদি role চাওয়া হয়
            if (fields === 'role') {
                return res.send({
                    success: true,
                    role: user.role
                });
            }
            // না হলে full data
            res.send({
                success: true,
                user
            });
        });


        app.patch('/users/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const updateData = req.body;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({ message: "Invalid user ID" });
                }


                const result = await userCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updateData }
                );

                const updatedUser = await userCollection.findOne({ _id: new ObjectId(id) });

                res.status(200).send({ message: "User updated successfully", user: updatedUser });
            } catch (error) {
                console.error(error);
                res.status(500).send({ message: "Internal server error" });
            }
        });


        // app.patch('/users/:id/role',
        //     //  verifyFirebaseToken, verifyAdmin, 
        //     async (req, res) => {
        //         const id = req.params.id;
        //         const roleInfo = req.body;
        //         const query = { _id: new ObjectId(id) };
        //         const updateDoc = {
        //             $set: {
        //                 role: roleInfo.role
        //             }
        //         }
        //         const result = await userCollection.updateOne(query, updateDoc);
        //         res.send(result);
        //     })

        app.post('/users', async (req, res) => {
            const user = req.body;
            user.role = "student";
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

        app.get("/courses", async (req, res) => {
            try {
                const { searchText, category, sort } = req.query;

                const query = {};

                // 🔹 Search by title
                if (searchText) {
                    // query.title = { $regex: searchText, $options: "i" };

                    query.$or = [
                        { title: { $regex: searchText, $options: 'i' } },
                        { examTitle: { $regex: searchText, $options: 'i' } }
                    ];
                }



                // 🔹 Filter by category title
                if (category) {
                    query["category.category_title"] = category;
                }

                // 🔹 Sort (latest / oldest)
                let sortOrder = {};
                if (sort) {
                    sortOrder.createAt = sort === "latest" ? -1 : 1;
                }

                const courses = await coursesCollection
                    .find(query)
                    .sort(sortOrder)
                    .toArray();

                res.status(200).send(courses);

            } catch (error) {
                console.error(error);
                res.status(500).send({ message: "Failed to fetch courses" });
            }
        });



        const getNextSequence = async (name) => {
            const result = await countersCourseCollection.findOneAndUpdate(
                { _id: name },
                { $inc: { seq: 1 } },
                { upsert: true, returnDocument: "after" }
            );

            if (!result || !result.value) {
                const doc = await countersCourseCollection.findOne({ _id: name });
                return doc?.seq || 1;
            }

            return result.value.seq;
        };


        // app.post("/courses", upload.single("thumbnail"), async (req, res) => {
        //     try {
        //         const courseData = JSON.parse(req.body.data);

        //         // Auto Increment ID
        //         const nextId = await getNextSequence("courseId");
        //         courseData.id = nextId.toString(); // যদি string রাখতে চান

        //         // If image uploaded
        //         if (req.file) {
        //             courseData.thumbnail = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
        //         } else {
        //             courseData.thumbnail = "";
        //         }

        //         // createdAt auto
        //         courseData.createdAt = new Date().toISOString();

        //         const result = await coursesCollection.insertOne(courseData);

        //         res.status(201).send({
        //             message: "success",
        //             courseId: result.insertedId,
        //         });

        //     } catch (error) {
        //         console.error(error);
        //         res.status(500).send({ message: "Internal server error" });
        //     }
        // });


        app.post("/courses", upload.single("thumbnail"), async (req, res) => {
            try {

                const courseData = JSON.parse(req.body.data);

                if (courseData.instructorIds?.length) {

                    const instructors = await userCollection
                        .find({
                            _id: { $in: courseData.instructorIds.map(id => new ObjectId(id)) }
                        })
                        .project({
                            _id: 1,
                            email: 1,
                            photoURL: 1,
                            displayName: 1,
                            jobTitle: 1
                        })
                        .toArray();

                    courseData.instructors = instructors;
                }


                const nextId = await getNextSequence("courseId");
                courseData.id = nextId.toString();

                if (req.file) {
                    courseData.thumbnail = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
                } else {
                    courseData.thumbnail = "";
                }

                courseData.createdAt = new Date().toISOString();

                const result = await coursesCollection.insertOne(courseData);

                res.status(201).send({ message: "success" });

            } catch (error) {
                console.error(error);
                res.status(500).send({ message: "Internal server error" });
            }
        });


        app.patch("/courses/:id", async (req, res) => {
            try {
                const id = req.params.id;
                const updateData = req.body;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({ message: "Invalid course ID" });
                }

                const course = await coursesCollection.findOne({
                    _id: new ObjectId(id),
                });

                if (!course) {
                    return res.status(404).send({ message: "Course not found" });
                }

                await coursesCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updateData }
                );

                const updatedCourse = await coursesCollection.findOne({
                    _id: new ObjectId(id),
                });

                res.status(200).send({
                    message: "Course updated successfully",
                    course: updatedCourse,
                });

            } catch (error) {
                console.error(error);
                res.status(500).send({ message: "Internal server error" });
            }
        });



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
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

