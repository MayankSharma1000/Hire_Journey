import express from "express";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { google } from "googleapis";

dotenv.config();

/*
  Job Application CRM Backend
  ---------------------------
  Features:
  1. Register/Login user
  2. Store jobs in data.json
  3. Edit/Delete jobs
  4. Connect Google Calendar using OAuth
  5. Add follow-up reminder to Google Calendar
*/

const app = express();
const PORT = process.env.PORT || 5005;
const DATA_FILE = "./data.json";

// Required because this project uses ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware to read JSON body from frontend requests
app.use(express.json());

// Serve frontend files from public folder
app.use(express.static(path.join(__dirname, "public")));

// Google OAuth client setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Calendar permission required to create events
const calendarScopes = ["https://www.googleapis.com/auth/calendar.events"];

// Read data.json safely
function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    const initialData = {
      users: [],
      jobs: []
    };

    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
  }

  const rawData = fs.readFileSync(DATA_FILE, "utf-8");

  return JSON.parse(rawData);
}

// Save updated data into data.json
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Home route fallback
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Register a new user
app.post("/api/register", (req, res) => {
  try {
    const data = readData();
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        message: "Username and password are required."
      });
    }

    const userExists = data.users.find(
      (user) => user.username.toLowerCase() === username.toLowerCase()
    );

    if (userExists) {
      return res.status(400).json({
        message: "User already exists. Please login."
      });
    }

    const newUser = {
      id: Date.now(),
      username,
      password,

      // Google Calendar tokens will be stored here after user connects calendar
      googleTokens: null
    };

    data.users.push(newUser);
    saveData(data);

    res.json({
      message: "Registered successfully. Now login.",
      user: newUser
    });
  } catch (error) {
    console.log("Register Error:", error);

    res.status(500).json({
      message: "Registration failed."
    });
  }
});

// Login existing user
app.post("/api/login", (req, res) => {
  try {
    const data = readData();
    const { username, password } = req.body;

    const user = data.users.find(
      (user) => user.username === username && user.password === password
    );

    if (!user) {
      return res.status(401).json({
        message: "Invalid username or password."
      });
    }

    res.json({
      message: "Login successful.",
      user
    });
  } catch (error) {
    console.log("Login Error:", error);

    res.status(500).json({
      message: "Login failed."
    });
  }
});

// Start Google Calendar permission flow
app.get("/auth/google/:userId", (req, res) => {
  const { userId } = req.params;

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.send(`
      <h2>Google OAuth is not configured.</h2>
      <p>Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file.</p>
    `);
  }

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: calendarScopes,

    // State helps us know which app user is connecting Google Calendar
    state: userId
  });

  res.redirect(authUrl);
});

// Google redirects here after user grants calendar permission
app.get("/auth/google/callback", async (req, res) => {
  try {
    const code = req.query.code;
    const userId = Number(req.query.state);

    if (!code) {
      return res.send("<h2>Google did not return an auth code.</h2>");
    }

    const { tokens } = await oauth2Client.getToken(code);

    const data = readData();

    data.users = data.users.map((user) => {
      if (user.id === userId) {
        return {
          ...user,
          googleTokens: tokens
        };
      }

      return user;
    });

    saveData(data);

    res.send(`
      <html>
        <body style="font-family: Arial; padding: 40px;">
          <h2>Google Calendar Connected Successfully ✅</h2>
          <p>You can now close this tab and return to your Job Application CRM.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.log("Google Callback Error:", error);

    res.send(`
      <h2>Failed to connect Google Calendar.</h2>
      <p>Please check your OAuth client settings and redirect URI.</p>
    `);
  }
});

// Get all jobs for a logged-in user
app.get("/api/jobs/:userId", (req, res) => {
  try {
    const data = readData();

    const userJobs = data.jobs.filter(
      (job) => job.userId === Number(req.params.userId)
    );

    res.json(userJobs);
  } catch (error) {
    console.log("Get Jobs Error:", error);

    res.status(500).json({
      message: "Failed to load jobs."
    });
  }
});

// Add a new job application
app.post("/api/jobs", (req, res) => {
  try {
    const data = readData();

    const newJob = {
      id: Date.now(),
      userId: Number(req.body.userId),
      company: req.body.company,
      role: req.body.role,
      salary: Number(req.body.salary),
      status: req.body.status,
      date: req.body.date,
      followUpDate: req.body.followUpDate || "",
      notes: req.body.notes || ""
    };

    data.jobs.push(newJob);
    saveData(data);

    res.json(newJob);
  } catch (error) {
    console.log("Add Job Error:", error);

    res.status(500).json({
      message: "Failed to add job."
    });
  }
});

// Update existing job application
app.put("/api/jobs/:id", (req, res) => {
  try {
    const data = readData();
    const jobId = Number(req.params.id);

    data.jobs = data.jobs.map((job) => {
      if (job.id === jobId) {
        return {
          ...job,
          company: req.body.company,
          role: req.body.role,
          salary: Number(req.body.salary),
          status: req.body.status,
          date: req.body.date,
          followUpDate: req.body.followUpDate || "",
          notes: req.body.notes || ""
        };
      }

      return job;
    });

    saveData(data);

    res.json({
      message: "Job updated successfully."
    });
  } catch (error) {
    console.log("Update Job Error:", error);

    res.status(500).json({
      message: "Failed to update job."
    });
  }
});

// Delete a job application
app.delete("/api/jobs/:id", (req, res) => {
  try {
    const data = readData();

    data.jobs = data.jobs.filter(
      (job) => job.id !== Number(req.params.id)
    );

    saveData(data);

    res.json({
      message: "Job deleted successfully."
    });
  } catch (error) {
    console.log("Delete Job Error:", error);

    res.status(500).json({
      message: "Failed to delete job."
    });
  }
});

// Create Google Calendar event for follow-up reminder
app.post("/api/calendar/create-event", async (req, res) => {
  try {
    const data = readData();

    const { userId, company, role, followUpDate } = req.body;

    if (!followUpDate) {
      return res.status(400).json({
        message: "Please add a follow-up date first."
      });
    }

    const user = data.users.find(
      (user) => user.id === Number(userId)
    );

    if (!user || !user.googleTokens) {
      return res.status(401).json({
        message: "Please connect Google Calendar first."
      });
    }

    // Use saved Google tokens for this user
    oauth2Client.setCredentials(user.googleTokens);

    const calendar = google.calendar({
      version: "v3",
      auth: oauth2Client
    });

    /*
      All-day event:
      If followUpDate is 2026-06-18,
      Google Calendar creates reminder on that date.
      Reminder is set to 1 day before.
    */
    const event = {
      summary: `Follow up with ${company}`,
      description: `Follow up regarding ${role} job application.`,
      start: {
        date: followUpDate
      },
      end: {
        date: followUpDate
      },
      reminders: {
        useDefault: false,
        overrides: [
          {
            method: "popup",
            minutes: 24 * 60
          },
          {
            method: "email",
            minutes: 24 * 60
          }
        ]
      }
    };

    const result = await calendar.events.insert({
      calendarId: "primary",
      requestBody: event
    });

    res.json({
      message: "Reminder added to Google Calendar.",
      eventLink: result.data.htmlLink
    });
  } catch (error) {
    console.log("Google Calendar Event Error:", error);

    res.status(500).json({
      message: "Failed to create Google Calendar event."
    });
  }
});

// Start backend server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});