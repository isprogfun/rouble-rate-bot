import { Db, MongoClient } from "mongodb";

let cachedDb: Db = null;

export default function connectToDatabase(uri: string) {
    console.log("=> connect to database");

    if (cachedDb) {
        console.log("=> using cached database instance");

        return Promise.resolve(cachedDb);
    }

    const client = new MongoClient(uri, { useNewUrlParser: true });

    return client.connect().then(() => {
        console.log("=> connected to database");
        cachedDb = client.db("roubleratebot");

        return cachedDb;
    });
}