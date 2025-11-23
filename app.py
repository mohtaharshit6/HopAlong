from flask import Flask, render_template, request, redirect, url_for
from uuid import uuid4

app = Flask(__name__)

rides = []


@app.route("/")
def home():
    return render_template("h1.html")


@app.route("/view-rides")
def view_rides():
    return render_template("h2.html", rides=rides)


@app.route("/offer-ride", methods=["POST"])
def offer_ride():
    seats = int(request.form.get("Seats"))

    if seats > 0:
        ride = {
            "id": str(uuid4()),
            "name": request.form.get("myName"),
            "start": request.form.get("mystartpoint"),
            "end": request.form.get("myendpoint"),
            "date": request.form.get("myDate"),
            "time": request.form.get("myTime"),
            "seats": seats,
            "fare": request.form.get("myFare")
        }
        rides.append(ride)

    return redirect(url_for("view_rides"))


@app.route("/ride/<ride_id>")
def ride_page(ride_id):
    ride = next((r for r in rides if r["id"] == ride_id), None)

    if ride is None:
        return "Ride not found", 404

    return render_template("ride_page.html", ride=ride)


@app.route("/book/<ride_id>", methods=["POST"])
def book_ride(ride_id):
    for ride in rides:
        if ride["id"] == ride_id and ride["seats"] > 0:
            ride["seats"] -= 1
            break

    return redirect(url_for("view_rides"))


if __name__ == "__main__":
    app.run(debug=True)