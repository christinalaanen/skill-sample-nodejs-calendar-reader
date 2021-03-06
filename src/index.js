var Alexa = require('alexa-sdk');
var ical = require('ical');
var http = require('http');
var utils = require('util');

var states = {
    SEARCHMODE: '_SEARCHMODE',
    DESCRIPTION: '_DESKMODE',
};
// local variable holding reference to the Alexa SDK object
var alexa;

//OPTIONAL: replace with "amzn1.ask.skill.[your-unique-value-here]";
var APP_ID = undefined;

// URL to get the .ics from
var URL = "https://calendar.google.com/calendar/ical/jofdpfpperbrodju9r3f1d9a1c%40group.calendar.google.com/public/basic.ics";

// Skills name
var skillName = "Japanese Lucky Day Calendar.     ";

// Message when the skill is first called
var welcomeMessage = "This is a U.S. calendar of lucky and unlucky days,  according to the Japanese.   What day do you want to know about? ";

// Message for help intent
var HelpMessage = "Here are some things you can say:   I want to know about today.  Tell me about next week?   What would you like to know?";

var descriptionStateHelpMessage = "Here are some things you can say: Tell me about list item one";

// Used when there is no data within a time period
var NoDataMessage = "Sorry I do not have information about that time frame.   Would you like to search again?";

// Used to tell user skill is closing
var shutdownMessage = "Ok, see you next time. Take care.";

// Message used when only 1 event is found allowing for difference in punctuation
var oneEventMessage = "OK, I can tell you about this day. ";

// Message used when more than 1 event is found allowing for difference in punctuation
var multipleEventMessage = "In this time frame, there are %d days I can tell you about.  ";

// text used after the number of events has been said
var scheduledEventMessage = " I've also sent the details to your Alexa app: ";

var firstThreeMessage = "Here are the first %d. ";

// the values within the {} are swapped out for variables
var eventSummary = "The %s day is, %s in %s on %s";

// Only used for the card on the companion app
var cardContentSummary = "%s in %s on %s, %s";

// More info text
var haveEventsRepromt = "Is there a day you want to ask about?";

// Error if a date is out of range
var dateOutOfRange = "Date is out of range please choose another date";

// Error if a event number is out of range
var eventOutOfRange = "List number is out of range please choose another";

// Used when an event is asked for
var descriptionMessage = "Here's the description: ";

// Used when exiting or cancelling
var killSkillMessage = "Ok, see you next time. Take care.";

var eventNumberMoreInfoText = "... Refer to the Alexa app for a copy of this information. ... Is there another day I can tell you about? Just ask, ... or say QUIT to end.";

// used for title on companion app
var cardTitle = "Lucky Day Summary";

// output for Alexa
var output = "";

// stores events that are found to be in our date range
var relevantEvents = new Array();

// Adding session handlers
var newSessionHandlers = {
    'LaunchRequest': function () {
        this.handler.state = states.SEARCHMODE;
        this.emit(':ask', skillName + " " + welcomeMessage, welcomeMessage);
    },
    "searchIntent": function()
    {
        this.handler.state = states.SEARCHMODE;
        this.emitWithState("searchIntent");
    },
    'Unhandled': function () {
        this.emit(':ask', HelpMessage, HelpMessage);
    },
};


// Create a new handler with a SEARCH state
var startSearchHandlers = Alexa.CreateStateHandler(states.SEARCHMODE, {
    'AMAZON.YesIntent': function () {
        output = welcomeMessage;
        alexa.emit(':ask', output, welcomeMessage);
    },

    'AMAZON.NoIntent': function () {
        this.emit(':tell', shutdownMessage);
    },

    'AMAZON.RepeatIntent': function () {
        this.emit(':ask', output, HelpMessage);
    },

    'searchIntent': function () {
        // Declare variables
        var eventList = new Array();
        var slotValue = this.event.request.intent.slots.date.value;
        if (slotValue != undefined)
        {
            var parent = this;

            // Using the iCal library I pass the URL of where we want to get the data from.
            ical.fromURL(URL, {}, function (err, data) {
                // Loop through all iCal data found
                for (var k in data) {
                    if (data.hasOwnProperty(k)) {
                        var ev = data[k];
                        // Pick out the data relevant to us and create an object to hold it.
                        var eventData = {
                            summary: removeTags(ev.summary),
                            location: removeTags(ev.location),
                            description: "... Description: " + removeTags(ev.description),
                            start: ev.start
                        };
                        // add the newly created object to an array for use later.
                        eventList.push(eventData);
                    }
                }
                // Check we have data
                if (eventList.length > 0) {
                    // Read slot data and parse out a usable date
                    var eventDate = getDateFromSlot(slotValue);
                    // Check we have both a start and end date
                    if (eventDate.startDate && eventDate.endDate) {
                        // initiate a new array, and this time fill it with events that fit between the two dates
                        relevantEvents = getEventsBeweenDates(eventDate.startDate, eventDate.endDate, eventList);

                        if (relevantEvents.length > 0) {
                            // change state to description - removed line below to prevent alexa from moving into another state
                            //parent.handler.state = states.DESCRIPTION;

                            // Create output for both Alexa and the content card
                            var cardContent = "";
                            output = oneEventMessage;
                            if (relevantEvents.length > 1) {
                                output = utils.format(multipleEventMessage, relevantEvents.length);
                            }

                            output += scheduledEventMessage;

                            if (relevantEvents.length > 1) {
                                output += utils.format(firstThreeMessage, relevantEvents.length > 3 ? 3 : relevantEvents.length);
                            }

                              if (relevantEvents[0] != null) {
                                  var date = new Date(relevantEvents[0].start);
                                  output += utils.format(eventSummary, " ", removeTags(relevantEvents[0].summary), relevantEvents[0].location, date.toDateString(), relevantEvents[0].description + ".");
                              }
                              if (relevantEvents[1]) {
                                  var date = new Date(relevantEvents[1].start);
                                  output += utils.format(eventSummary, "Next", removeTags(relevantEvents[1].summary), relevantEvents[1].location, date.toDateString(), relevantEvents[1].description + ".");
                              }
                              if (relevantEvents[2]) {
                                  var date = new Date(relevantEvents[2].start);
                                  output += utils.format(eventSummary, "Next", removeTags(relevantEvents[2].summary), relevantEvents[2].location, date.toDateString(), relevantEvents[2].description + ".");
                              }

                              for (var i = 0; i < relevantEvents.length; i++) {
                                  var date = new Date(relevantEvents[i].start);
                                  cardContent += utils.format(cardContentSummary, removeTags(relevantEvents[i].summary), removeTags(relevantEvents[i].location), date.toDateString(), relevantEvents[i].description+ "\n\n");
                              }

                            output += eventNumberMoreInfoText;
                            alexa.emit(':askWithCard', output, haveEventsRepromt, cardTitle, cardContent);

                        //else if relevant event length is not longer than 0
                        } else {
                            output = NoDataMessage;
                            alexa.emit(':ask', output, output);
                        }
                    //else if there's no date range
                    } else {
                        output = NoDataMessage;
                        alexa.emit(':ask', output, output);
                    }
                //if there's no event data at all
                } else {
                    output = NoDataMessage;
                    alexa.emit(':ask', output, output);
                }
            }); //closes if slot value is not undefined
        //doesn't fall anywhere else in the searchIntent parameters
        } else {
            this.emit(":ask", "I'm sorry.  What day did you want me to look into?", "I'm sorry.  What day did you want me to look into?");
        }
    }, //closes search intent

    'AMAZON.HelpIntent': function () {
        output = HelpMessage;
        this.emit(':ask', output, output);
    },

    'AMAZON.StopIntent': function () {
        this.emit(':tell', killSkillMessage);
    },

    'AMAZON.CancelIntent': function () {
        this.emit(':tell', killSkillMessage);
    },

    'SessionEndedRequest': function () {
        this.emit('AMAZON.StopIntent');
    },

    'Unhandled': function () {
        this.emit(':ask', HelpMessage, HelpMessage);
    }
});

//removed description search handle (integrated the description into the search instead)

// register handlers
exports.handler = function (event, context, callback) {
    alexa = Alexa.handler(event, context);
    alexa.appId = APP_ID;
    alexa.registerHandlers(newSessionHandlers, startSearchHandlers);
    alexa.execute();
};
//======== HELPER FUNCTIONS ==============

// Remove HTML tags from string
function removeTags(str) {
    if (str) {
        return str.replace(/<(?:.|\n)*?>/gm, '');
    }
}

// Given an AMAZON.DATE slot value parse out to usable JavaScript Date object
// Utterances that map to the weekend for a specific week (such as �this weekend�) convert to a date indicating the week number and weekend: 2015-W49-WE.
// Utterances that map to a month, but not a specific day (such as �next month�, or �December�) convert to a date with just the year and month: 2015-12.
// Utterances that map to a year (such as �next year�) convert to a date containing just the year: 2016.
// Utterances that map to a decade convert to a date indicating the decade: 201X.
// Utterances that map to a season (such as �next winter�) convert to a date with the year and a season indicator: winter: WI, spring: SP, summer: SU, fall: FA)
function getDateFromSlot(rawDate) {
    // try to parse data
    var date = new Date(Date.parse(rawDate));
    var result;
    // create an empty object to use later
    var eventDate = {

    };

    // if could not parse data must be one of the other formats
    if (isNaN(date)) {
        // to find out what type of date this is, we can split it and count how many parts we have see comments above.
        var res = rawDate.split("-");
        // if we have 2 bits that include a 'W' week number
        if (res.length === 2 && res[1].indexOf('W') > -1) {
            var dates = getWeekData(res);
            eventDate["startDate"] = new Date(dates.startDate);
            eventDate["endDate"] = new Date(dates.endDate);
            // if we have 3 bits, we could either have a valid date (which would have parsed already) or a weekend
        } else if (res.length === 3) {
            var dates = getWeekendData(res);
            eventDate["startDate"] = new Date(dates.startDate);
            eventDate["endDate"] = new Date(dates.endDate);
            // anything else would be out of range for this skill
        } else {
            eventDate["error"] = dateOutOfRange;
        }
        // original slot value was parsed correctly
    } else {
        eventDate["startDate"] = new Date(date).setUTCHours(0, 0, 0, 0);
        eventDate["endDate"] = new Date(date).setUTCHours(24, 0, 0, 0);
    }
    return eventDate;
}

// Given a week number return the dates for both weekend days
function getWeekendData(res) {
    if (res.length === 3) {
        var saturdayIndex = 5;
        var sundayIndex = 6;
        var weekNumber = res[1].substring(1);

        var weekStart = w2date(res[0], weekNumber, saturdayIndex);
        var weekEnd = w2date(res[0], weekNumber, sundayIndex);

        return Dates = {
            startDate: weekStart,
            endDate: weekEnd,
        };
    }
}

// Given a week number return the dates for both the start date and the end date
function getWeekData(res) {
    if (res.length === 2) {

        var mondayIndex = 0;
        var sundayIndex = 6;

        var weekNumber = res[1].substring(1);

        var weekStart = w2date(res[0], weekNumber, mondayIndex);
        var weekEnd = w2date(res[0], weekNumber, sundayIndex);

        return Dates = {
            startDate: weekStart,
            endDate: weekEnd,
        };
    }
}

// Used to work out the dates given week numbers
var w2date = function (year, wn, dayNb) {
    var day = 86400000;

    var j10 = new Date(year, 0, 10, 12, 0, 0),
        j4 = new Date(year, 0, 4, 12, 0, 0),
        mon1 = j4.getTime() - j10.getDay() * day;
    return new Date(mon1 + ((wn - 1) * 7 + dayNb) * day);
};

// Loops though the events from the iCal data, and checks which ones are between our start data and out end date
function getEventsBeweenDates(startDate, endDate, eventList) {

    var start = new Date(startDate);
    var end = new Date(endDate);

    var data = new Array();

    for (var i = 0; i < eventList.length; i++) {
        if (start <= eventList[i].start && end >= eventList[i].start) {
            data.push(eventList[i]);
        }
    }

    console.log("FOUND " + data.length + " events between those times");
    return data;
}
