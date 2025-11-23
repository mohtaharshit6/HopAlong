# 🚗 HopAlong

HopAlong is a simple ride-sharing web app built with *Flask*.  
Users can offer rides, view available rides in a card layout, open ride details, and book seats.  
The app is made as a college project to understand basic full-stack concepts.

---

## 🧩 Features

- Offer a ride using a form (name, source, destination, date, time, seats, fare)
- View all available rides in a clean card layout
- Click on a ride card to view full details
- Book a ride from the details page
- Seats are updated dynamically after booking
- Ride is hidden automatically when seats become zero

---

## 🛠 Tech Stack

- *Backend:* Python, Flask
- *Frontend:* HTML, CSS, Bootstrap
- *Templates:* Jinja2
- *Storage:* In-memory Python list (no database yet)

---

## 📁 Project Structure

```text
project/
│
├─ app.py
│
├─ templates/
│   ├─ h1.html          # Offer Ride page
│   ├─ h2.html          # View Rides page
│   └─ ride_page.html   # Ride details + booking page
│
└─ static/
    ├─ h1.css
    ├─ h2.css
    └─ logo-removebg-preview.png
