/*
  Job Application CRM Frontend
  ----------------------------
  This file controls:
  1. Register/Login
  2. Add/Edit/Delete jobs
  3. Search/Filter/Sort
  4. Kanban board
  5. Follow-up reminders
  6. Google Calendar integration
  7. Dark mode
  8. CSV export
*/

// Backend API URL
const API_URL = "http://localhost:5005";

// ================= HTML ELEMENT SELECTION =================

// Auth elements
const authSection = document.getElementById("authSection");
const dashboard = document.getElementById("dashboard");
const authMessage = document.getElementById("authMessage");
const welcomeText = document.getElementById("welcomeText");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");

// Form elements
const jobForm = document.getElementById("jobForm");
const jobTableBody = document.getElementById("jobTableBody");
const companyInput = document.getElementById("company");
const roleInput = document.getElementById("role");
const salaryInput = document.getElementById("salary");
const statusInput = document.getElementById("status");
const dateInput = document.getElementById("date");
const followUpDateInput = document.getElementById("followUpDate");
const notesInput = document.getElementById("notes");
const submitBtn = document.getElementById("submitBtn");

// Search/filter/sort elements
const searchInput = document.getElementById("searchInput");
const filterStatus = document.getElementById("filterStatus");
const sortBy = document.getElementById("sortBy");

// Stats elements
const totalJobs = document.getElementById("totalJobs");
const interviewJobs = document.getElementById("interviewJobs");
const offerJobs = document.getElementById("offerJobs");
const averageSalary = document.getElementById("averageSalary");
const highestSalary = document.getElementById("highestSalary");

// ================= APP STATE =================

// Logged-in user is stored in localStorage so page refresh does not log out
let currentUser = JSON.parse(localStorage.getItem("currentUser")) || null;

// All jobs loaded from backend
let allJobs = [];

// If editJobId is null, form adds a new job.
// If it contains an id, form updates that job.
let editJobId = null;

// Show dashboard directly if user was already logged in
if (currentUser) {
  showDashboard();
}

// ================= AUTH FUNCTIONS =================

// Register a new user
async function registerUser() {
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  if (!username || !password) {
    authMessage.textContent = "Please enter username and password.";
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    authMessage.textContent = data.message;
  } catch (error) {
    console.log("Register Error:", error);
    authMessage.textContent = "Server error. Please check backend.";
  }
}

// Login existing user
async function loginUser() {
  console.log("Login button clicked");
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  if (!username || !password) {
    authMessage.textContent = "Please enter username and password.";
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password })
    });

    const text = await response.text();
    console.log("SERVER RESPONSE:", text);
    const data = JSON.parse(text);
    
    if (!response.ok) {
      authMessage.textContent = data.message;
      return;
    }

    currentUser = data.user;

    localStorage.setItem("currentUser", JSON.stringify(currentUser));

    showDashboard();
  } catch (error) {
    console.log("Login Error:", error);
    authMessage.textContent = "Server error. Please check backend.";
  }
}

// Show dashboard after successful login
function showDashboard() {
  console.log("showDashboard running");

  // Hide login page
  authSection.classList.add("hidden");
  authSection.style.display = "none";

  // Show dashboard forcefully
  dashboard.classList.remove("hidden");
  dashboard.style.display = "block";

  // Welcome text
  welcomeText.textContent = `Welcome, ${currentUser.username}`;

  // Load jobs
  loadJobs();
}

// Logout User
function logoutUser() {
  // Remove saved login from browser
  localStorage.removeItem("currentUser");

  // Reset global variables
  currentUser = null;
  allJobs = [];

  console.log("Logged out successfully");

  // Reload page
  location.reload();
}

// ================= JOB CRUD FUNCTIONS =================

// Add or update job when form is submitted
jobForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const jobData = {
    userId: currentUser.id,
    company: companyInput.value.trim(),
    role: roleInput.value.trim(),
    salary: salaryInput.value,
    status: statusInput.value,
    date: dateInput.value,
    followUpDate: followUpDateInput.value,
    notes: notesInput.value.trim()
  };

  try {
    if (editJobId) {
      // Update existing job
      await fetch(`${API_URL}/api/jobs/${editJobId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(jobData)
      });

      editJobId = null;
      submitBtn.textContent = "Add Job";
    } else {
      // Add new job
      await fetch(`${API_URL}/api/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(jobData)
      });
    }

    jobForm.reset();
    loadJobs();
  } catch (error) {
    console.log("Save Job Error:", error);
    alert("Unable to save job. Check backend.");
  }
});

// Load jobs from backend for current user
async function loadJobs() {
  try {
    const response = await fetch(`${API_URL}/api/jobs/${currentUser.id}`);

    allJobs = await response.json();

    renderJobs();
    updateStats();
    renderKanbanBoard();
    renderReminders();
  } catch (error) {
    console.log("Load Jobs Error:", error);
  }
}

// Display jobs in table
function renderJobs() {
  jobTableBody.innerHTML = "";

  let jobsToShow = [...allJobs];

  const searchText = searchInput.value.toLowerCase();
  const selectedStatus = filterStatus.value;
  const selectedSort = sortBy.value;

  // Search and status filter
  jobsToShow = jobsToShow.filter((job) => {
    const matchesSearch =
      job.company.toLowerCase().includes(searchText) ||
      job.role.toLowerCase().includes(searchText);

    const matchesStatus =
      selectedStatus === "All" || job.status === selectedStatus;

    return matchesSearch && matchesStatus;
  });

  // Sort jobs
  if (selectedSort === "newest") {
    jobsToShow.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  if (selectedSort === "oldest") {
    jobsToShow.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  if (selectedSort === "salaryHigh") {
    jobsToShow.sort((a, b) => Number(b.salary) - Number(a.salary));
  }

  if (selectedSort === "salaryLow") {
    jobsToShow.sort((a, b) => Number(a.salary) - Number(b.salary));
  }

  if (jobsToShow.length === 0) {
    jobTableBody.innerHTML = `
      <tr>
        <td colspan="8">No job applications found.</td>
      </tr>
    `;
    return;
  }

  jobsToShow.forEach((job) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${job.company}</td>
      <td>${job.role}</td>
      <td>₹${Number(job.salary).toLocaleString("en-IN")}</td>
      <td>
        <span class="status ${job.status}">
          ${job.status}
        </span>
      </td>
      <td>${job.date}</td>
      <td>${job.followUpDate || "Not set"}</td>
      <td>${job.notes || "-"}</td>
      <td>
        <button
          class="calendar-btn"
          onclick="addJobToGoogleCalendar(${job.id})"
        >
          📅 Calendar
        </button>

        <button
          class="edit-btn"
          onclick="editJob(${job.id})"
        >
          ✏️ Edit
        </button>

        <button
          class="delete-btn"
          onclick="deleteJob(${job.id})"
        >
          🗑 Delete
        </button>
      </td>
    `;

    jobTableBody.appendChild(row);
  });
}

// Fill form with selected job data for editing
function editJob(id) {
  const job = allJobs.find((job) => job.id === id);

  if (!job) {
    return;
  }

  companyInput.value = job.company;
  roleInput.value = job.role;
  salaryInput.value = job.salary;
  statusInput.value = job.status;
  dateInput.value = job.date;
  followUpDateInput.value = job.followUpDate || "";
  notesInput.value = job.notes || "";

  editJobId = id;
  submitBtn.textContent = "Update Job";

  // Scroll to form
  jobForm.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

// Delete selected job
async function deleteJob(id) {
  const confirmDelete = confirm("Are you sure you want to delete this job?");

  if (!confirmDelete) {
    return;
  }

  try {
    await fetch(`${API_URL}/api/jobs/${id}`, {
      method: "DELETE"
    });

    loadJobs();
  } catch (error) {
    console.log("Delete Job Error:", error);
  }
}

// ================= DASHBOARD FUNCTIONS =================

// Update dashboard statistics
function updateStats() {
  const total = allJobs.length;

  const interviews = allJobs.filter(
    (job) => job.status === "Interview"
  ).length;

  const offers = allJobs.filter(
    (job) => job.status === "Offer"
  ).length;

  const salaries = allJobs.map((job) => Number(job.salary || 0));

  const avg =
    salaries.length === 0
      ? 0
      : salaries.reduce((sum, salary) => sum + salary, 0) / salaries.length;

  const highest = salaries.length === 0 ? 0 : Math.max(...salaries);

  totalJobs.textContent = total;
  interviewJobs.textContent = interviews;
  offerJobs.textContent = offers;
  averageSalary.textContent = `₹${Math.round(avg).toLocaleString("en-IN")}`;
  highestSalary.textContent = `₹${highest.toLocaleString("en-IN")}`;
}

// Render Kanban board based on job status
function renderKanbanBoard() {
  const columns = {
    Applied: document.getElementById("appliedColumn"),
    Interview: document.getElementById("interviewColumn"),
    Rejected: document.getElementById("rejectedColumn"),
    Offer: document.getElementById("offerColumn")
  };

  // Clear old cards
  Object.values(columns).forEach((column) => {
    column.innerHTML = "";
  });

  allJobs.forEach((job) => {
    const card = document.createElement("div");

    card.className = "kanban-card";

    card.innerHTML = `
      <h4>${job.company}</h4>
      <p>${job.role}</p>
      <p>₹${Number(job.salary).toLocaleString("en-IN")}</p>
    `;

    columns[job.status].appendChild(card);
  });
}

// Render follow-up reminder cards
function renderReminders() {
  const reminderList = document.getElementById("reminderList");

  reminderList.innerHTML = "";

  const today = new Date();

  const reminders = allJobs.filter((job) => job.followUpDate);

  if (reminders.length === 0) {
    reminderList.innerHTML = "<p>No follow-up reminders set.</p>";
    return;
  }

  reminders.forEach((job) => {
    const followDate = new Date(job.followUpDate);

    const daysLeft = Math.ceil(
      (followDate - today) / (1000 * 60 * 60 * 24)
    );

    let reminderText = "";

    if (daysLeft < 0) {
      reminderText = "Overdue";
    } else if (daysLeft === 0) {
      reminderText = "Follow up today";
    } else {
      reminderText = `${daysLeft} day(s) left`;
    }

    const card = document.createElement("div");

    card.className = "reminder-card";

    card.innerHTML = `
      <div class="reminder-icon">📅</div>

      <div class="reminder-content">
        <h4>${job.company} - ${job.role}</h4>

        <p>
          Follow-up Date:
          <strong>${job.followUpDate}</strong>
        </p>

        <p class="reminder-status">
          ${reminderText}
        </p>

        <button
          class="calendar-btn calendar-reminder-btn"
          onclick="addJobToGoogleCalendar(${job.id})"
        >
          Add To Google Calendar
        </button>
      </div>
    `;

    reminderList.appendChild(card);
  });
}

// ================= GOOGLE CALENDAR FUNCTIONS =================

// Opens Google OAuth permission screen
function connectGoogleCalendar() {
  if (!currentUser) {
    alert("Please login first.");
    return;
  }

  window.location.href = `${API_URL}/auth/google/${currentUser.id}`;
}

// Adds selected job's follow-up date to Google Calendar
async function addJobToGoogleCalendar(id) {
  const job = allJobs.find((job) => job.id === id);

  if (!job) {
    alert("Job not found.");
    return;
  }

  if (!job.followUpDate) {
    alert("Please add a follow-up date first.");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/calendar/create-event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId: currentUser.id,
        company: job.company,
        role: job.role,
        followUpDate: job.followUpDate
      })
    });

    const data = await response.json();

    alert(data.message);

    if (data.eventLink) {
      window.open(data.eventLink, "_blank");
    }
  } catch (error) {
    console.log("Calendar Error:", error);
    alert("Failed to add Google Calendar reminder.");
  }
}

// ================= UTILITY FUNCTIONS =================

// Toggle dark mode
function toggleDarkMode() {
  document.body.classList.toggle("dark");
}

// Export all jobs as CSV
function exportCSV() {
  if (allJobs.length === 0) {
    alert("No jobs to export.");
    return;
  }

  const headings = [
    "Company",
    "Role",
    "Salary",
    "Status",
    "Applied Date",
    "Follow Up Date",
    "Notes"
  ];

  const rows = allJobs.map((job) => [
    job.company,
    job.role,
    job.salary,
    job.status,
    job.date,
    job.followUpDate || "",
    job.notes || ""
  ]);

  const csvContent = [
    headings.join(","),
    ...rows.map((row) => row.map((item) => `"${item}"`).join(","))
  ].join("\n");

  const blob = new Blob([csvContent], {
    type: "text/csv"
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = "job-applications.csv";
  link.click();

  URL.revokeObjectURL(url);
}

// ================= EVENT LISTENERS =================

searchInput.addEventListener("input", renderJobs);
filterStatus.addEventListener("change", renderJobs);
sortBy.addEventListener("change", renderJobs);