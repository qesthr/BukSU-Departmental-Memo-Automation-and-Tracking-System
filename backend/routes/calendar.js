import express from "express";
import { listEvents } from "../googleCalendar.js";

const router = express.Router();

router.get("/events", async (req, res) => {
  try {
    const events = await listEvents();
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching calendar events");
  }
});

export default router;
