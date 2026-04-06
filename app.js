const express = require("express");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");

const app = express();
app.use(express.json());

/* ================= CONFIG ================= */

// MongoDB
const mongoURI = "mongodb://127.0.0.1:27017/hospital_db";

// Gmail for sending mails
const HOSPITAL_EMAIL = "nagababunani057589@gmail.com";
const HOSPITAL_EMAIL_PASSWORD = "qite xbyg bdqq kbua";

// Doctor login + doctor mail
const doctorLogin = {
  id: "doctor",
  pass: "doc123",
  email: "nagababunani057589@gmail.com"
};

/* ================= MONGO_DB CONNECTION ================= */

mongoose.connect(mongoURI)
  .then(() => console.log("✅ MongoDB Connected Successfully"))
  .catch(err => console.log("❌ MongoDB Connection Error:", err));

/* ================= MAIL SETUP ================= */

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: HOSPITAL_EMAIL,
    pass: HOSPITAL_EMAIL_PASSWORD
  }
});

async function sendMail(to, subject, text) {
  try {
    await transporter.sendMail({
      from: HOSPITAL_EMAIL,
      to,
      subject,
      text
    });
    console.log("✅ Mail sent to:", to);
    return true;
  } catch (err) {
    console.log("❌ Mail sending failed:", err);
    return false;
  }
}

/* ================= DATABASE MODELS ================= */

// Patient Schema
const patientSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  pass: { type: String, required: true }
});
const Patient = mongoose.model("Patient", patientSchema);

// Appointment Schema
const appointmentSchema = new mongoose.Schema({
  patient: String,
  email: String,
  doctor: String,
  date: String,
  time: String,
  issue: String,
  status: { type: String, default: "Pending" }
}, { timestamps: true });

const Appointment = mongoose.model("Appointment", appointmentSchema);

/* ================= API ROUTES ================= */

// Signup
app.post("/signup", async (req, res) => {
  try {
    const { id, email, pass } = req.body;

    if (!id || !email || !pass) {
      return res.status(400).json({ success: false, msg: "Fill all fields" });
    }

    const exists = await Patient.findOne({ id });
    if (exists) {
      return res.status(400).json({ success: false, msg: "User already exists" });
    }

    const newPatient = new Patient({ id, email, pass });
    await newPatient.save();

    return res.json({ success: true, msg: "Account created successfully" });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, msg: "Signup failed" });
  }
});

// Login
app.post("/login", async (req, res) => {
  try {
    const { role, id, pass } = req.body;

    if (!id || !pass) {
      return res.json({ success: false, msg: "Enter ID and Password" });
    }

    if (role === "doctor") {
      if (id === doctorLogin.id && pass === doctorLogin.pass) {
        return res.json({
          success: true,
          email: doctorLogin.email,
          msg: "Doctor login successful"
        });
      }
      return res.json({ success: false, msg: "Invalid doctor login" });
    }

    const user = await Patient.findOne({ id, pass });
    if (!user) {
      return res.json({ success: false, msg: "Invalid patient login" });
    }

    return res.json({
      success: true,
      email: user.email,
      msg: "Patient login successful"
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, msg: "Login failed" });
  }
});

// Book Appointment + send mail to doctor
app.post("/appointment", async (req, res) => {
  try {
    const { patient, email, doctor, date, time, issue } = req.body;

    if (!patient || !email || !doctor || !date || !time) {
      return res.json({ success: false, msg: "Fill all appointment fields" });
    }

    const newAppt = new Appointment({
      patient,
      email,
      doctor,
      date,
      time,
      issue: issue || ""
    });

    await newAppt.save();

    const doctorSubject = "New Appointment Booked";
    const doctorText = `
Hello Doctor,

A new appointment has been booked.

Patient ID: ${patient}
Patient Email: ${email}
Doctor Department: ${doctor}
Date: ${date}
Time: ${time}
Issue: ${issue || "Not mentioned"}
Status: Pending

Please login and review this appointment.
    `;

    const doctorMailSent = await sendMail(doctorLogin.email, doctorSubject, doctorText);

    if (doctorMailSent) {
      return res.json({
        success: true,
        msg: "Appointment booked successfully and mail sent to doctor"
      });
    } else {
      return res.json({
        success: true,
        msg: "Appointment booked successfully but doctor mail failed"
      });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, msg: "Booking failed" });
  }
});

// Get Appointments
app.get("/appointments", async (req, res) => {
  try {
    const data = await Appointment.find().sort({ createdAt: -1 });
    res.json(data);
  } catch (err) {
    console.log(err);
    res.status(500).json([]);
  }
});

// Update Status + send mail to patient
app.put("/appointment/:id", async (req, res) => {
  try {
    const { status } = req.body;

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!updatedAppointment) {
      return res.status(404).json({ success: false, msg: "Appointment not found" });
    }

    const patientSubject = `Appointment ${status}`;
    const patientText = `
Hello ${updatedAppointment.patient},

Your appointment has been ${status} by the doctor.

Doctor Department: ${updatedAppointment.doctor}
Date: ${updatedAppointment.date}
Time: ${updatedAppointment.time}
Issue: ${updatedAppointment.issue || "Not mentioned"}
Status: ${updatedAppointment.status}

Thank you.
    `;

    const patientMailSent = await sendMail(
      updatedAppointment.email,
      patientSubject,
      patientText
    );

    if (patientMailSent) {
      return res.json({
        success: true,
        msg: `Appointment ${status} successfully and mail sent to patient`
      });
    } else {
      return res.json({
        success: true,
        msg: `Appointment ${status} successfully but patient mail failed`
      });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, msg: "Update failed" });
  }
});

/* ================= FRONTEND ================= */

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Hospital Appointment Booking System</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
      background: linear-gradient(135deg, #dbeafe, #eff6ff, #f8fafc);
    }

    nav {
      background: #2563eb;
      color: white;
      padding: 14px 20px;
      display: none;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }

    nav a {
      color: white;
      margin-right: 18px;
      text-decoration: none;
      font-weight: bold;
      cursor: pointer;
    }

    .title {
      text-align: center;
      color: #1e3a8a;
      margin-top: 30px;
      font-size: 32px;
      font-weight: bold;
    }

    .subtitle {
      text-align: center;
      color: #475569;
      margin-bottom: 15px;
    }

    .box {
      width: 430px;
      max-width: 92%;
      margin: 35px auto;
      background: #fff;
      padding: 24px;
      border-radius: 14px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
      display: none;
    }

    input, select, textarea, button {
      width: 100%;
      padding: 12px;
      margin-top: 10px;
      margin-bottom: 10px;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      box-sizing: border-box;
      font-size: 14px;
    }

    textarea {
      min-height: 90px;
      resize: vertical;
    }

    button {
      background: #2563eb;
      color: white;
      border: none;
      cursor: pointer;
      font-weight: bold;
    }

    button:hover {
      background: #1d4ed8;
    }

    h2 {
      text-align: center;
      color: #1d4ed8;
      margin-bottom: 16px;
    }

    .switch {
      text-align: center;
      color: #2563eb;
      cursor: pointer;
      font-weight: bold;
    }

    .small-note {
      text-align: center;
      color: #64748b;
      font-size: 13px;
    }

    #listSection {
      width: 92%;
      max-width: 1200px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      background: white;
      border-radius: 10px;
      overflow: hidden;
    }

    th {
      background: #2563eb;
      color: white;
      padding: 12px;
    }

    td {
      border: 1px solid #e5e7eb;
      padding: 10px;
      text-align: center;
    }

    .pending {
      color: orange;
      font-weight: bold;
    }

    .approved {
      color: green;
      font-weight: bold;
    }

    .rejected {
      color: red;
      font-weight: bold;
    }

    .approve-btn {
      background: green;
      color: white;
      border: none;
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      width: auto;
      margin-right: 5px;
    }

    .reject-btn {
      background: red;
      color: white;
      border: none;
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      width: auto;
    }
  </style>
</head>
<body>

<div class="title">Hospital Appointment Booking System</div>
<div class="subtitle">Book appointments and get email notifications</div>

<nav id="navbar">
  <span id="nav-role" style="margin-right:20px; font-weight:bold;"></span>
  <a onclick="showSection('bookSection')" id="book-link">Book Appointment</a>
  <a onclick="loadAppointments()">Appointments</a>
  <a onclick="logoutUser()">Logout</a>
</nav>

<div id="loginBox" class="box" style="display:block;">
  <h2>Login</h2>
  <select id="l-role">
    <option value="patient">Patient</option>
    <option value="doctor">Doctor</option>
  </select>
  <input id="l-id" placeholder="Enter User ID">
  <input type="password" id="l-pass" placeholder="Enter Password">
  <button onclick="loginUser()">Login</button>
  <p class="switch" onclick="showBox('signupBox')">New user? Signup</p>
  <p class="small-note">Doctor Login ID: doctor | Password: doc123</p>
</div>

<div id="signupBox" class="box">
  <h2>Signup</h2>
  <input id="s-id" placeholder="Create User ID">
  <input id="s-email" placeholder="Enter Email">
  <input type="password" id="s-pass" placeholder="Create Password">
  <button onclick="signupUser()">Signup</button>
  <p class="switch" onclick="showBox('loginBox')">Back to Login</p>
</div>

<div id="bookSection" class="box">
  <h2>Book Appointment</h2>
  <select id="a-doc">
    <option>General Physician</option>
    <option>Cardiologist</option>
    <option>Dermatologist</option>
    <option>Orthopedic</option>
    <option>Neurologist</option>
  </select>
  <input type="date" id="a-date">
  <input type="time" id="a-time">
  <textarea id="a-issue" placeholder="Describe your health issue"></textarea>
  <button onclick="bookAppt()">Book Now</button>
</div>

<div id="listSection" class="box">
  <h2>Appointments</h2>
  <table>
    <thead>
      <tr>
        <th>Patient</th>
        <th>Email</th>
        <th>Doctor</th>
        <th>Date</th>
        <th>Time</th>
        <th>Issue</th>
        <th>Status</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody id="tableBody"></tbody>
  </table>
</div>

<script>
let user = null;

function showBox(id) {
  document.querySelectorAll('.box').forEach(b => b.style.display = 'none');
  document.getElementById(id).style.display = 'block';
}

function showSection(id) {
  showBox(id);
}

function logoutUser() {
  user = null;
  document.getElementById('navbar').style.display = 'none';
  document.getElementById('book-link').style.display = 'inline';
  showBox('loginBox');
}

async function signupUser() {
  const id = document.getElementById('s-id').value.trim();
  const email = document.getElementById('s-email').value.trim();
  const pass = document.getElementById('s-pass').value.trim();

  if (!id || !email || !pass) {
    alert("Fill all signup fields");
    return;
  }

  try {
    const res = await fetch('/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, email, pass })
    });

    const data = await res.json();
    alert(data.msg);

    if (data.success) {
      document.getElementById('s-id').value = "";
      document.getElementById('s-email').value = "";
      document.getElementById('s-pass').value = "";
      showBox('loginBox');
    }
  } catch (e) {
    alert("Signup failed");
  }
}

async function loginUser() {
  const role = document.getElementById('l-role').value;
  const id = document.getElementById('l-id').value.trim();
  const pass = document.getElementById('l-pass').value.trim();

  if (!id || !pass) {
    alert("Enter login details");
    return;
  }

  try {
    const res = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, id, pass })
    });

    const data = await res.json();

    if (data.success) {
      user = { id, role, email: data.email };
      document.getElementById('navbar').style.display = 'block';
      document.getElementById('nav-role').innerText = role.toUpperCase();

      document.getElementById('l-id').value = "";
      document.getElementById('l-pass').value = "";

      if (role === 'doctor') {
        document.getElementById('book-link').style.display = 'none';
        loadAppointments();
      } else {
        document.getElementById('book-link').style.display = 'inline';
        showSection('bookSection');
      }
    } else {
      alert(data.msg);
    }
  } catch (e) {
    alert("Login error");
  }
}

async function bookAppt() {
  const doctor = document.getElementById('a-doc').value;
  const date = document.getElementById('a-date').value;
  const time = document.getElementById('a-time').value;
  const issue = document.getElementById('a-issue').value.trim();

  if (!doctor || !date || !time) {
    alert("Fill all appointment fields");
    return;
  }

  try {
    const res = await fetch('/appointment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient: user.id,
        email: user.email,
        doctor,
        date,
        time,
        issue
      })
    });

    const data = await res.json();
    alert(data.msg);

    if (data.success) {
      document.getElementById('a-date').value = "";
      document.getElementById('a-time').value = "";
      document.getElementById('a-issue').value = "";
      loadAppointments();
    }
  } catch (e) {
    alert("Booking failed");
  }
}

async function loadAppointments() {
  try {
    const res = await fetch('/appointments');
    const data = await res.json();
    const body = document.getElementById('tableBody');
    body.innerHTML = '';

    data.forEach(a => {
      if (user.role === 'patient' && a.patient !== user.id) return;

      let actionHtml = '-';
      if (user.role === 'doctor' && a.status === 'Pending') {
        actionHtml = \`
          <button class="approve-btn" onclick="updateStatus('\${a._id}', 'Approved')">Approve</button>
          <button class="reject-btn" onclick="updateStatus('\${a._id}', 'Rejected')">Reject</button>
        \`;
      }

      body.innerHTML += \`
        <tr>
          <td>\${a.patient}</td>
          <td>\${a.email}</td>
          <td>\${a.doctor}</td>
          <td>\${a.date}</td>
          <td>\${a.time}</td>
          <td>\${a.issue || ''}</td>
          <td class="\${a.status.toLowerCase()}">\${a.status}</td>
          <td>\${actionHtml}</td>
        </tr>
      \`;
    });

    showSection('listSection');
  } catch (e) {
    alert("Cannot load appointments");
  }
}

async function updateStatus(id, status) {
  try {
    const res = await fetch('/appointment/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });

    const data = await res.json();
    alert(data.msg);
    loadAppointments();
  } catch (e) {
    alert("Update failed");
  }
}
</script>

</body>
</html>
  `);
});

app.listen(3000, () => {
  console.log("🚀 Server running at http://localhost:3000");
});