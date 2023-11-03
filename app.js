import "dotenv/config";
import Fastify from "fastify";
import Axios from "axios";
import neo4j from "neo4j-driver";
import { v4 as uuidv4 } from "uuid";

const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
);

const fastify = Fastify({
    logger: true,
});

// Declare a route
fastify.get("/", async function handler(request, reply) {
    let res = {}
    const session = driver.session();
    const result = await session.run(
        "MATCH (n:Palette) RETURN n LIMIT 25;"
    );
    result.records.map((p,i)=>{
        res[p._fields[0].properties.id] = []
    })
    session.close();
    Object.keys(res).map(async (id)=>{
        const session = driver.session();
        const colors = await session.run(
            `MATCH p=()-[:COMPOSICAO]->(:Palette {id: $id}) RETURN p LIMIT 25;`,{
                id:id
            }
        );
        res[id] = colors.records[0]
        session.close();
    })
    const singleRecord = result.records[0];
    const node = singleRecord.get(0);

    session.close();
    return res;
});
fastify.post("/", async function handler(request, reply) {
    const { colors } = request.body;
    const session = driver.session();
    const id = uuidv4();
    await session.run("CREATE (p:Palette {id: $id})", {
        id: id,
    });
    session.close();
    colors.forEach(async function (value) {
        const session = driver.session();
        const result = await session.run(
            "MATCH (n:Color {value: $value}) Return n",
            {
                value: value.substring(1, 7),
            }
        );
        if (!result.records.length) {
            const color = await session.run(
                "CREATE (c:Color {name: $name, value: $value, contrast: $contrast})",
                {
                    name: data.name.value,
                    value: value.substring(1, 7),
                    contrast: data.contrast.value,
                }
            );
        }
        await session.run(
            `MERGE (c : Color {value: $value})
            MERGE (p : Palette {id: $id}) 
            MERGE (c)-[r: COMPOSICAO]->(p)`,
            {
                id: id,
                value: value.substring(1, 7),
            }
        );

        session.close();
    });
    return { Result: "OK" };
});

// Run the server!
try {
    await fastify.listen({ port: 3000 });
} catch (err) {
    fastify.log.error(err);
    await driver.close();
    process.exit(1);
}
