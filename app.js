import "dotenv/config";
import Fastify from "fastify";
import Axios from "axios";
import neo4j from "neo4j-driver";
import cors from "@fastify/cors";
import { v4 as uuidv4 } from "uuid";
const driver = neo4j.driver(
  "neo4j+s://d3fa20a5.databases.neo4j.io",
  neo4j.auth.basic("neo4j", "QlZ_UhgfuxU2YJ1HrxhXsh7iAmDaqc1TfmQ-pnGi2Sg")
);
const fastify = Fastify({
  logger: true,
});
await fastify.register(cors, (instance) => {
  return (req, callback) => {
    const corsOptions = {
      // This is NOT recommended for production as it enables reflection exploits
      origin: true,
    };
    callback(null, corsOptions);
  };
});

// Declare a route
fastify.get("/", async function handler(request, reply) {
  let res = {};
  const session = driver.session();
  const result = await session.run(
    "MATCH p=(Color{})-[:COMPOSICAO]->(:Palette {}) RETURN p;"
  );
  result.records.map((c) => {
    res[c.get(0).end.properties.id] = res[c.get(0).end.properties.id]
      ? res[c.get(0).end.properties.id]
      : [];
    res[c.get(0).end.properties.id].push(c.get(0).start.properties);
  });
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
      const { data } = await Axios.get(
        "https://www.thecolorapi.com/id?hex=" + value.substring(1, 7)
      );
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
