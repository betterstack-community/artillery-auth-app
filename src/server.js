import "dotenv/config";
import Fastify from "fastify";
import pug from "pug";
import fastifyView from "@fastify/view";
import fastifyFormbody from "@fastify/formbody";
import ajvErrors from "ajv-errors";
import fastifyCookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import { faker } from "@faker-js/faker";
import path from "node:path";
import * as url from "node:url";
import { loginSchema } from "./schema.js";
import { UserManager } from "./user.js";
import { port, appURL } from "./config.js";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const views = path.join(__dirname, "templates");

const fastify = Fastify({
  logger: true,
  requestTimeout: 30000,
  ajv: {
    customOptions: {
      // Warning: Enabling this option may lead to this security issue https://www.cvedetails.com/cve/CVE-2020-8192/
      allErrors: true,
      $data: true,
    },
    plugins: [ajvErrors],
  },
});

fastify.register(fastifyCookie, {
  hook: "onRequest",
});

fastify.register(fastifyView, {
  engine: {
    pug,
  },
});

fastify.register(fastifyStatic, {
  root: path.join(__dirname, "public/"),
});

fastify.register(fastifyFormbody);

fastify.get("/dashboard", (req, reply) => {
  const signedIn = req.cookies.signedIn;
  if (!signedIn) {
    return reply.redirect(303, "/login");
  }

  reply.view("./src/templates/dashboard.pug", {
    title: "Dashboard",
  });
});

fastify.get("/login", (req, reply) => {
  const signedIn = req.cookies.signedIn;
  if (signedIn) {
    return reply.redirect(303, "/dashboard");
  }

  reply.view("./src/templates/login.pug", { title: "Log in" });
});

fastify.post(
  "/login",
  {
    schema: {
      body: loginSchema,
    },
    attachValidation: true,
  },
  async (req, reply) => {
    const { email, password } = req.body;
    if (req.validationError) {
      const error = req.validationError;
      const data = {
        title: "Login in",
        errors: error.validation.map((err) => {
          return {
            key: err.instancePath.substring(1),
            value: err.message,
          };
        }),
      };

      return reply.status(400).view("./src/templates/login.pug", data);
    }

    reply
      .setCookie("signedIn", "true", {
        domain: appURL.hostname,
        path: "/",
        maxAge: 3600,
      })
      .redirect(303, "/dashboard");
  }
);

fastify.get("/logout", (req, reply) => {
  reply
    .clearCookie("signedIn", {
      domain: appURL.hostname,
      path: "/",
    })
    .redirect(303, "/login");
});

fastify.get("/api/data", (req, reply) => {
  const contentTypeHeader = req.headers["content-type"];

  if (contentTypeHeader && contentTypeHeader.includes("application/json")) {
    // Sample JSON response
    const jsonData = {
      message: "This is a JSON response",
      data: {
        email: faker.internet.email(),
        password: faker.internet.password(),
      },
    };
    reply.send(jsonData);
  } else {
    // Render Pug template
    const pugData = {
      title: "Rendered Data",
      message: "This is an HTML response",
      data: {
        email: faker.internet.email(),
        password: faker.internet.password(),
      },
    };
    reply.view("./src/templates/api-data.pug", pugData);
  }
});

fastify.get("/", (req, reply) => {
  reply.view("./src/templates/index.pug", { title: "Welcome" });
});

fastify.listen({ port }, function (err, address) {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }

  fastify.log.info(`Fastify is listening on port: ${address}`);
});
