// __tests__/admin.int.test.cjs
const request = require("supertest");

let app;

beforeAll(async () => {
  // Import the ESM server and grab the app
  app = (await import("../server.js")).default;
});

test("201 on valid event", async () => {
  const payload = { name: "Basketball", date: "2025-11-20", tickets: 100 };
  const res = await request(app).post("/api/admin/events").send(payload);
  expect(res.statusCode).toBe(201);
  expect(res.body).toHaveProperty("event.id");
  expect(res.body.event).toMatchObject({
    name: payload.name,
    date: payload.date,
    tickets: payload.tickets,
  });
});

test("400 on invalid tickets", async () => {
  const bad = { name: "BadEvent", date: "2025-11-20", tickets: -1 };
  const res = await request(app).post("/api/admin/events").send(bad);
  expect(res.statusCode).toBe(400);
});
