



const express = require('express')
const serverless = require('serverless-http'); // npm install serverless-http
const app = express()
require('dotenv').config()
const port = process.env.PORT || 3000;
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
// MiddleWare
app.use(express.json());
app.use(cors());
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");


// course er image er jonno multer sue kore

const multer = require("multer");
// const path = require("path");

// Multer Storage Setup

// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//         cb(null, "uploads/");
//     },
//     filename: function (req, file, cb) {
//         const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
//         cb(null, uniqueSuffix + path.extname(file.originalname));
//     },
// });

// const upload = multer({ storage });


// config
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET,
});

// storage
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: "courses", // optional folder name
        allowed_formats: ["jpg", "png", "jpeg", "webp"],
    },
});

const upload = multer({ storage });


// Create uploads folder if not exists
// const fs = require("fs");
// if (!fs.existsSync("uploads")) {
//     fs.mkdirSync("uploads");
// }

// Serve images statically
// app.use("/uploads", express.static("uploads"));

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
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@simple-crud-server.30cfyeq.mongodb.net/?appName=simple-crud-server`;



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
        const categoryCollecton = db.collection("categories")
        const userCollection = db.collection("users");
        const countersCourseCollection = db.collection("course-counters");
        const countersCategoyCollection = db.collection("category-counters");
        const enrollCollection = db.collection("enrollments");

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


        app.patch('/users/:id', upload.single("photo"), async (req, res) => {
            try {
                const id = req.params.id;

                // Parse other fields if sent as JSON in 'data'
                const updateData = req.body.data ? JSON.parse(req.body.data) : req.body;

                // If a new photo is uploaded, set its URL
                // if (req.file) {
                //     updateData.photoURL = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
                // }

                if (req.file) {
                    updateData.photoURL = req.file.path; // 🔥 Cloudinary URL
                }


                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({ message: "Invalid user ID" });
                }

                // Update the user
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


        // category api
        app.get("/categories", async (req, res) => {
            try {
                const { searchText, sort, id, } = req.query;

                let query = {}; // 🔹 এটা declare করতে হবে
                if (id) {
                    query.categoryId = id;
                }

                // 🔹 Search by title
                if (searchText) {
                    query.$or = [
                        { category_title: { $regex: searchText, $options: "i" } },
                        // { examTitle: { $regex: searchText, $options: "i" } }
                    ];
                }
                let sortOrder = {};
                if (sort) {
                    sortOrder.createAt = sort === "latest" ? -1 : 1;
                }

                const categories = await categoryCollecton.find(query).sort(sortOrder).toArray();
                res.status(200).send(categories);
            } catch (error) {
                console.error("Fetch error:", error);
                res.status(500).send({ message: "Failed to fetch categories" });
            }
        });


        const getCategoryNextSequence = async (name) => {
            const result = await countersCategoyCollection.findOneAndUpdate(
                { _id: name },
                { $inc: { seq: 1 } },
                { upsert: true, returnDocument: "after" }
            );

            if (!result || !result.value) {
                const doc = await countersCategoyCollection.findOne({ _id: name });
                return doc?.seq || 1;
            }

            return result.value.seq;
        };

        app.post("/category", upload.single("image"), async (req, res) => {

            try {

                const categoryData = JSON.parse(req.body.data);

                // Auto Increment Category ID
                const nextId = await getCategoryNextSequence("categoryId");
                categoryData.categoryId = nextId.toString();

                // Image Upload
                if (req.file) {
                    categoryData.image = req.file.path; // 🔥 Cloudinary URL
                } else {
                    categoryData.image = "";
                }

                // Created Time
                categoryData.createdAt = new Date().toISOString();

                const result = await categoryCollecton.insertOne(categoryData);

                res.status(201).send({ message: "success" });

            } catch (error) {

                console.error(error);
                res.status(500).send({ message: "Internal server error" });

            }

        });

        app.patch("/category/:id", upload.single("image"), async (req, res) => {
            try {
                const CategoryId = req.params.id;

                const updateData = req.body.data ? JSON.parse(req.body.data) : {};

                // 🔹 নতুন image দিলে
                if (req.file) {
                    updateData.image = req.file.path; // 🔥 Cloudinary URL
                }

                // 🔹 image remove করলে
                if (updateData.removeImage) {
                    updateData.image = "";
                }

                delete updateData.removeImage;

                await categoryCollecton.updateOne(
                    { categoryId: CategoryId },
                    { $set: updateData }
                );

                const updatedCategory = await categoryCollecton.findOne({ categoryId: CategoryId });

                res.status(200).send({
                    message: "success",
                    category: updatedCategory
                });

            } catch (error) {
                console.error(error);
                res.status(500).send({ message: "Internal server error" });
            }
        });

        // enrolled ment course api

        app.post("/enroll", async (req, res) => {
            try {
                const { userEmail, courseId } = req.body;

                const exist = await enrollCollection.findOne({ userEmail, courseId });

                if (exist) {
                    return res.send({ message: "Already Enrolled" });
                }

                const enrollData = {
                    userEmail,
                    courseId,
                    enrolledAt: new Date()
                };

                await enrollCollection.insertOne(enrollData);

                res.send({ success: true });

            } catch (err) {
                res.status(500).send({ message: "Enroll failed" });
            }
        });

        // get my course api
        app.get("/my-enroll-course", async (req, res) => {
            try {
                const email = req.query.email;

                const enrolled = await enrollCollection.find({ userEmail: email }).toArray();

                const courseIds = enrolled.map(item => item.courseId);

                const courses = await coursesCollection
                    .find({ id: { $in: courseIds } })
                    .toArray();

                res.send(courses);

            } catch (err) {
                res.status(500).send({ message: "Failed to fetch" });
            }
        });

        // single course
        // app.get("/my-enroll-single-course/:id", async (req, res) => {
        //     try {
        //         const id = req.params.id;

        //         const course = await coursesCollection.findOne({ id });

        //         if (!course) {
        //             return res.status(404).send({ message: "Course not found" });
        //         }

        //         res.send(course);

        //     } catch (err) {
        //         res.status(500).send({ message: "Error fetching course" });
        //     }
        // });

        app.get("/my-enroll-single-course/:id", async (req, res) => {
            try {
                const email = req.query.email;
                const id = req.params.id;

                const isEnrolled = await enrollCollection.findOne({
                    userEmail: email,
                    courseId: id
                });

                if (!isEnrolled) {
                    return res.status(403).send({ message: "Access denied" });
                }

                const course = await coursesCollection.findOne({ id });

                if (!course) {
                    return res.status(404).send({ message: "Course not found" });
                }

                res.send(course);

            } catch (err) {
                res.status(500).send({ message: "Error fetching course" });
            }
        });


        // courses contents

        app.patch("/courses/add-content", async (req, res) => {
            try {
                const { courseId, topic, contentName, contentLink, type } = req.body;

                // 🔹 Course find (custom id দিয়ে)
                const course = await coursesCollection.findOne({ id: courseId });

                if (!course) {
                    return res.status(404).send({ message: "Course not found" });
                }

                // 🔹 New Content
                const newContent = {
                    contentName,
                    contentLink,
                    type,
                };

                // 🔹 Topic exist check
                const topicIndex = course.course_contents?.findIndex(
                    (item) => item.topic === topic
                );

                if (topicIndex !== -1 && topicIndex !== undefined) {
                    // 👉 Topic exists → push content
                    await coursesCollection.updateOne(
                        { id: courseId, "course_contents.topic": topic },
                        {
                            $push: {
                                "course_contents.$.contents": newContent,
                            },
                        }
                    );
                } else {
                    // 👉 Topic নেই → নতুন topic create + content add
                    await coursesCollection.updateOne(
                        { id: courseId },
                        {
                            $push: {
                                course_contents: {
                                    topic,
                                    contents: [newContent],
                                },
                            },
                        }
                    );
                }

                res.send({
                    status: true,
                    message: "Content added successfully",
                });

            } catch (error) {
                console.error(error);
                res.status(500).send({ message: "Failed to add content" });
            }
        });

        app.patch("/courses/update-content", async (req, res) => {
            try {
                const { courseId, moduleIndex, subIndex, data } = req.body;

                const course = await coursesCollection.findOne({
                    _id: new ObjectId(courseId),
                });

                if (!course) {
                    return res.status(404).send({ message: "Course not found" });
                }

                // 🔥 topics clone
                const topics = course.topics || [];

                if (!topics[moduleIndex]) {
                    return res.status(400).send({ message: "Module not found" });
                }

                if (!topics[moduleIndex].sub_topics[subIndex]) {
                    return res.status(400).send({ message: "Content not found" });
                }

                // 🔥 update data
                topics[moduleIndex].sub_topics[subIndex] = {
                    ...topics[moduleIndex].sub_topics[subIndex],
                    title: data?.title,
                    type: data?.type,
                    link: data?.link,
                };

                // 🔥 save updated topics
                await coursesCollection.updateOne(
                    { _id: new ObjectId(courseId) },
                    {
                        $set: { topics },
                    }
                );

                res.send({
                    success: true,
                    message: "Content updated successfully",
                });

            } catch (error) {
                console.error(error);
                res.status(500).send({ message: "Update failed" });
            }
        });


        app.patch("/courses/update-outline/:id", async (req, res) => {
            try {
                const courseId = req.params.id;
                const { topics } = req.body;

                const result = await coursesCollection.updateOne(
                    { id: courseId },
                    {
                        $set: {
                            topics: topics, // 🔥 only this field update
                        },
                    }
                );

                res.send({
                    status: true,
                    message: "Outline updated successfully",
                    result,
                });
            } catch (error) {
                res.status(500).send({
                    message: "Failed to update outline",
                });
            }
        });



        // courses api

        app.get("/courses", async (req, res) => {
            try {
                const { searchText, category, sort, id, status } = req.query;

                const query = {};

                // 🔹 Filter by Course ID
                if (id) {
                    query.id = id; // আপনার database এ যেই id field আছে
                }

                // 🔹 Search by title
                if (searchText) {
                    query.$or = [
                        { title: { $regex: searchText, $options: "i" } },
                        { examTitle: { $regex: searchText, $options: "i" } }
                    ];
                }

                // 🔹 Filter by category title
                if (category) {
                    query["category.category_title"] = category;
                }

                // 🔹 Filter by status (publish / draft)
                if (status === "publish" || status === "draft") {
                    query.status = status;
                }
                // যদি status na thake, sob status er courses dibe (no filter)

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
                    courseData.thumbnail = req.file.path; // 🔥 Cloudinary URL
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

        app.patch("/courses/:id", upload.single("thumbnail"), async (req, res) => {
            try {
                const courseId = req.params.id; // 🟢 custom id, _id নয়

                // Multer parse করার পর req.body.data আসবে
                const updateData = JSON.parse(req.body.data);

                // যদি নতুন image আসে
                if (req.file) {
                    updateData.thumbnail = req.file.path; // 🔥 Cloudinary URL
                }

                // 🔹 Custom id দিয়ে course খোঁজা
                const course = await coursesCollection.findOne({ id: courseId });
                if (!course) return res.status(404).send({ message: "Course not found" });

                await coursesCollection.updateOne(
                    { id: courseId },
                    { $set: updateData }
                );

                const updatedCourse = await coursesCollection.findOne({ id: courseId });

                res.status(200).send({ message: "success", course: updatedCourse });

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

// app.listen(port, () => {
//     console.log(`Example app listening on port ${port}`)
// })

module.exports = app;
module.exports.handler = serverless(app);