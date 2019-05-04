#!/usr/bin/python
#
# Simple program to calculate the day of the week and moon phase given an Inner Sea date.
# Assumes that 1 AR was on a Moonday, and that it was a full moon.
# Does not work with dates before 1 AR.
#
# Usage:
# Print out a calendar (in DokuWiki) for the entire year:
#   inner_sea_calendar.py <year>
#
# Print out a calendar (as a DokuWiki fragment) for a given month:
#   inner_sea_calendar.py <year> <month>
#
# Simply report the week day and moon phase for a specific day:
#   inner_sea_calendar.py <year> <month> <day>
#
# Copyright (c) 2017, Samuel Penn
# All rights reserved.
#
# Redistribution and use in source and binary forms, with or without
# modification, are permitted provided that the following conditions are met:
#
# 1. Redistributions of source code must retain the above copyright notice, this
#    list of conditions and the following disclaimer.
# 2. Redistributions in binary form must reproduce the above copyright notice,
#    this list of conditions and the following disclaimer in the documentation
#    and/or other materials provided with the distribution.
#
# THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
# ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
# WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
# DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
# ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
# (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
# LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
# ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
# (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
# SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
#
# The views and conclusions contained in the software and documentation are those
# of the authors and should not be interpreted as representing official policies,
# either expressed or implied, of the FreeBSD Project.
#

import math
import sys

# Calendar Constants
MONTH_DAYS = [ 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 ]
LEAP_DAYS = [ 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 ]
YEAR_LENGTH = sum(MONTH_DAYS)
LEAP_YEAR = 8
MOON_PERIOD = 29.5

HTML=False

WEEK = [ "Moonday", "Toilday", "Wealday", "Oathday", "Fireday", "Starday", "Sunday" ]

MONTH = [ "Abadius", "Calistril", "Pharast", "Gozren", "Desnus", "Sarenith", "Erastus", "Arodus", "Rova", "Lamashan", "Neth", "Kuthona" ]

MOON_PHASES = [ "Full Moon", "Waning Gibbous", "Third Quarter", "Waning Crescent", "New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous" ]
MOON_UNICODE = [ "&#x1F315;", "&#x1F316", "&#x1F317", "&#x1F318", "&#x1F311", "&#x1F312", "&#x1F313", "&#x1F314" ]
PHASE_LENGTH = [ 3, 4, 4, 4, 2, 4, 4, 4 ]
BRIGHTNESS = [ 3, 2, 2, 1, 0, 1, 2, 2 ]

def getYear(epocDay):
    yearLength = (YEAR_LENGTH + ( 1.0 / LEAP_YEAR))

    year = math.ceil(epocDay / yearLength)

    return int(year);

def getDayInYear(epocDay):
    year = getYear(epocDay)

    yearLength = (YEAR_LENGTH + ( 1.0 / LEAP_YEAR))
    dayInYear = int(epocDay - (year-1) * yearLength) + 1

    return dayInYear;

def getMonthInYear(epocDay):
    cal = MONTH_DAYS
    isLeapYear = (getYear(epocDay) % 8) == 0
    if (isLeapYear):
        cal = LEAP_DAYS

    dayInYear = getDayInYear(epocDay)

    month = 0
    while dayInYear > cal[month]:
        dayInYear -= cal[month]
        month += 1

    return month + 1

def getDayInMonth(epocDay):
    cal = MONTH_DAYS
    isLeapYear = (getYear(epocDay) % 8) == 0
    if (isLeapYear):
        cal = LEAP_DAYS

    dayInYear = getDayInYear(epocDay)

    month = 0
    while dayInYear > cal[month]:
        dayInYear -= cal[month]
        month += 1

    return dayInYear


# Get the epoc day from a date. This is the number of days since the first
# day of the year in 1 AR. 1/1/1 is epoc day 1 (epoc day 0 does not exist).
def getEpocDay(day, month, year):
    cal = MONTH_DAYS
    isLeapYear = (year % 8) == 0
    if (isLeapYear):
        cal = LEAP_DAYS

    epocDay = (YEAR_LENGTH + ( 1.0 / LEAP_YEAR)) * (year - 1)
    epocDay += sum(cal[:month-1])
    epocDay += day

    return int(epocDay);

# Returns a number from 1 - 7.
def getDayOfWeek(day, month, year):
    epocDay = getEpocDay(day, month, year)
    dayOfWeek = (epocDay - 1) % len(WEEK) + 1

    return dayOfWeek

def getEpocDayOfWeek(epocDay):
    return (epocDay - 1) % len(WEEK) + 1

# Returns the name of the day for this date.
def getNamedDayOfWeek(day, month, year):
    dayOfWeek = getDayOfWeek(day, month, year)

    return WEEK[dayOfWeek - 1]

# Returns the name of this phase of the Moon.
def getMoonPhase(day, month, year):
    epocDay = getEpocDay(day, month, year)

    moonDay = epocDay - int(MOON_PERIOD * int(epocDay / MOON_PERIOD))
    phase = 0
    while (moonDay > 0):
        moonDay -= PHASE_LENGTH[phase]
        if (moonDay > 0):
            phase += 1

    return MOON_PHASES[phase]

# Returns the index of this phase of the Moon, 0-7. 0 = Full Moon, 4 = New Moon.
def getMoonPhaseIndex(day, month, year):
    epocDay = getEpocDay(day, month, year)

    moonDay = epocDay - int(MOON_PERIOD * int(epocDay / MOON_PERIOD))
    phase = 0
    while (moonDay > 0):
        moonDay -= PHASE_LENGTH[phase]
        if (moonDay > 0):
            phase += 1

    return phase

def calendar(month, year):
    cal = MONTH_DAYS
    isLeapYear = (year % 8) == 0
    if (isLeapYear):
        cal = LEAP_DAYS

    epocStartDay = getEpocDay(1, month, year)
    epocEndDay = getEpocDay(cal[month-1], month, year)

    if (HTML):
        html = "<h2>" + MONTH[month - 1] + "</h2>\n"
    else:
        html = "===== " + MONTH[month - 1] + " =====\n"

    if (HTML):
        html += "<table>\n<tr>"
        for name in WEEK:
            html += "<th>" + name + "</th>"
        html += "</tr>\n"
    else:
        html += "\n"
        for name in WEEK:
            html += "^  " + name + "  "
        html += "^\n"

    today = epocStartDay + 1 - getEpocDayOfWeek(epocStartDay)
    
    if (HTML):
        while today <= epocEndDay:
            if getEpocDayOfWeek(today) == 1:
                html += "<tr>\n"

            if today < epocStartDay:
                html += "<td></td>\n"
            else:
                phase="<span>" + MOON_UNICODE[getMoonPhaseIndex(getDayInMonth(today), month, year)] + "</span>"
                html += "<td>" + str(getDayInMonth(today)) + phase + "</td>\n"

            if getEpocDayOfWeek(today) == 7:
                html += "</tr>\n"

            today += 1
    else:
        while today <= epocEndDay:

            if today < epocStartDay:
                html += "| "
            else:
                phase = "{{ " + str(getMoonPhaseIndex(getDayInMonth(today), month, year)) + ".png?24&nolink}}"
                html += "|" + str(getDayInMonth(today)) + phase + "\\\\ \\\\ "

            if getEpocDayOfWeek(today) == 7:
                html += "|\n"

            today += 1

        html += "\n|"

    if (HTML):
        print("</table>\n")
    else:
        for d in range(0, 7):
            html += " +++++++++++ |"
        html += "\n"

    return html

def outputCSS(title):
    print("<html>\n<head>\n<title>" + title + "</title>\n")
    print("<style>\n")
    print("table, th, td {\n")
    print("    border: 1px solid black;\n")
    print("    border-collapse;\n")
    print("    font-size: large;\n")
    print("}\n")
    print("td {\n")
    print("  width: 8em;\n")
    print("  height: 5em;\n")
    print("  vertical-align: top;\n")
    print("}\n")
    print("td span {\n")
    print("  align: right;\n")
    print("  float: right;\n")
    print("}\n")
    print("</style>\n</head>\n<body>\n")

def outputEnd():
    print("</body>\n</html>\n")

if (len(sys.argv) > 1):
    if (sys.argv[1] == "--html"):
        sys.argv.pop(0)
        HTML=True

if (len(sys.argv) == 4):
    argDay = int(sys.argv[3])
    argMonth = int(sys.argv[2])
    argYear = int(sys.argv[1])

    print getNamedDayOfWeek(argDay, argMonth, argYear) + " - " + getMoonPhase(argDay, argMonth, argYear)
elif (len(sys.argv) == 3):
    argMonth = int(sys.argv[2])
    argYear = int(sys.argv[1])

    if (HTML):
        outputCSS(MONTH[argMonth - 1] + " " + str(argYear) + " AR")

    print calendar(argMonth, argYear)

    if (HTML):
        outputEnd()
elif (len(sys.argv) == 2):
    argYear = int(sys.argv[1])

    if (HTML):
        outputCSS(str(argYear) + " AR")
        print "<h1>" + str(argYear) + " AR</h1>\n"
    else:
        print "====== " + str(argYear) + " AR ======\n"


    for month in range(1, 13):
        print calendar(month, argYear)

    print "\n"

    if (HTML):
        outputEnd()
