---
title: Notes
---
- [ ] Make the description for the services optional
- [ ] List the services on the homepage. Make a "booking request" page. Edge script to save or expose an API on admin?
- [ ] When we talk about "getting an e-mail" for the admins or the squad members it means sending an e-mail *and* a browser notification (as implemented in iter-23)
- [ ] We now talk about "Events", but also about booking requests. I'm wondering if "event" even is an entity that we still need. Maybe it would make sense to just talk about bookings. An admin also creates a booking - and not an event. Let's rename it - also in the DB - everywhere. But also let's discuss again. "A squad member is assigned to an event" and not "A squad member is assigned to a booking". Does is make sense to have a entity "event" plus an entity "booking"? They can't live without each other, so it may not make sense.
- [ ] Idea: Squad member should get a reminder e-mail & notification the day before a booking/event

# Booking request flow
Just send an e-mail inquiry.

Booking request:
- Date, time
- time of duty (min. 5h)
- Venue & Location
- Choose services
	- Number of an item
	- If per hour - for how
- Comment field
- Mention "call out fees" if the location is not in Zurich
- A descriptive text to mention:
	- Breaks
	- Dinner breaks
	- Min. time of duty duration

When an booking is requested, an "event" is created and the corresponding service line items are added to this event. Check again how the services are attached to an event. As discussed earlier, they need to be added as immutable, because the price won't change anymore of a service of this event, also when the price for this service will change in the future.

When the request is submitted by the customer, all admins get an e-mail with a link to see the booking request. 
- We have a page /booking-request
- "call out fees" can be added manually.
- Special services (that are not listed in the service catalog) that are requested (e.g. a hair dryer) can be added manually incl. a price.
- The admin can then send an "offer"
- The customer gets the offer per e-mail
	- Does the e-mail contain all the details or just a link to the offer page?
	- If we have an offer-page, what about security? The customer does not have a login. Is it enough to create a UUID for the offer and just "protect" it that URLs are not guessable?
	- It would be very easy to have an offer page, because the customer could then directly "accept" the offer on this page by checking "terms and services" and clicking a button
- The admin needs a way to see open offers, can open them and also accept or "archive" them
- When an offer is accepted an e-mail is sent to the customer with all the details. When the customer accepted the offer, the admins also get an e-mail. When an admin accepts an offer manually, only the customer gets an e-mail
# Squad assignment flow
An admin can assign a squad member to a booking/event. The squad member gets an e-mail with a link, where the assignment needs to be confirmed. In the squad member view, the assignment can be cancelled (see below).
# Squad member view
[[iteration-18-squad-views]] introduces a view for squad members. There, they should see their assigned bookings (aka events). They should have the possibilities to reject an assignment. This should trigger an e-mail to the admins.
The squad view also should contains a button to download the event as an ics file that can be imported into a calendar.
# Invoice
After the event, an invoice should be generated. [Abaninja](https://abaninja.ch/apidocs/) is used. No details yet.




