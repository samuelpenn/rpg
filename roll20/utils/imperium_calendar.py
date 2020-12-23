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
# If first parameter is --html, then outputs in HTML format rather than Dokuwiki syntax.
# If so, then uses unicode characters for the Moon phases.
#
# If there is an --images parameter, then reads the directory for images files to user
# to produce a picture for each month, one month per page.
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
import argparse
import os

# Calendar Constants
MONTH_DAYS = 28
YEAR_LENGTH = 365


HTML=False

WEEK = [ "Wonday", "Tuday", "Thirday", "Forday", "Fiday", "Sixday", "Senday" ]


def getMonthInYear(epocDay):
    cal = MONTH_DAYS
    dayInYear = getDayInYear(epocDay)

    month = 0
    while dayInYear > cal[month]:
        dayInYear -= cal[month]
        month += 1

    return month + 1

def getDayInMonth(epocDay):
    cal = MONTH_DAYS

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

    epocDay = (YEAR_LENGTH) * (year - 1)
    epocDay += cal * (month - 1)
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


def calendar(month):
    cal = MONTH_DAYS

    if (HTML):
        html = "<div class='month'><h2>Month " + month + "</h2>\n"
        if (args.images):
            html += "<img src='" + args.images + "/" + str(month) + ".jpg'/>";
    else:
        html = "===== " + str(month) + " =====\n"

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

    startOfMonth = 2 + (month - 1) * 28
    today = startOfMonth
    
    if (HTML):
        while today <= epocEndDay:
            if getEpocDayOfWeek(today) == 1:
                html += "<tr>\n"

            if today < epocStartDay:
                html += "<td></td>\n"
            else:
                phase="<span class='phase'>" + MOON_UNICODE[getMoonPhaseIndex(getDayInMonth(today), month, year)] + "</span>"
                moonDay = ""
                if (today in listOfMoons):
                    moonDay = "<span class='name'>" + listOfMoons[today] + " Moon</span>"
                html += "<td>" + str(getDayInMonth(today)) + phase + moonDay + "</td>\n"

            if getEpocDayOfWeek(today) == 7:
                html += "</tr>\n"

            today += 1
    else:
        while today < (startOfMonth + 28):
            html += ("| {day:03d} \\\\ ".format( day = today))

            if (today - 1) % 7 == 0:
                html += "|\n"

            today += 1

        html += "|"

    if (HTML):
        print("</table></div>\n")
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
    print("div.month {\n")
    print("    page-break-inside: avoid;\n")
    print("}\n")
    print("img {\n")
    print("  width: 100%;\n")
    print("}\n")
    print("h2 {\n")
    print("  margin-bottom: 0px\n");
    print("}\n");
    print("p {\n")
    print("  margin: 0px\n");
    print("}\n");
    print("td {\n")
    print("  width: 8em;\n")
    print("  height: 4.5em;\n")
    print("  vertical-align: top;\n")
    print("}\n")
    print("td span.phase {\n")
    print("  align: right;\n")
    print("  float: right;\n")
    print("}\n")
    print("td span.name {\n")
    print("  vertical-align: top;\n")
    print("  display: block;\n")
    print("  float: right;\n")
    print("  clear: right;\n")
    print("  font-size: small;\n")
    print("  font-style: italic;\n")
    print("}\n")
    print("</style>\n</head>\n<body>\n")

def outputEnd():
    print("</body>\n</html>\n")


parser = argparse.ArgumentParser(
    description="Output Inner Sea calendar with days and moon phases. " +
                "Uses DokuWiki format unless HTML is specified.",
    epilog="If only a year is specified, outputs the whole year. " +
           "If a year and month is given, outputs the whole month. " +
           "If a year, month and day is given, only outputs a single day.")
parser.add_argument("-H", "--html", dest="html", action="store_true", default=False, help="Output as HTML.")
parser.add_argument("-i", "--images", dest="images", help="Path to image folder.")
parser.add_argument("dates", metavar="Date to display", type=int, nargs='+', help="<year> [<month> [<day>]]")

args = parser.parse_args()

HTML=args.html

# If an image directory is specified, validate that it exists and contains
# images.
if (args.images):
    if (not os.path.exists(args.images)):
        print("Path [" + args.images + "] does not exist.\n");
        exit(2)
    if (not os.path.isdir(args.images)):
        print("Path [" + args.images + "] is not a directory.\n");
        exit(2)
    
    for m in range(1, 13):
        if (not os.path.exists(args.images + "/" + str(m) + ".jpg")):
            print("Directory [" + args.images + "] must contain 12 images 1.jpg .. 12.jpg")
            exit(2)

if (len(args.dates) == 3):
    argDay = int(args.dates[2])
    argMonth = int(args.dates[1])
    argYear = int(args.dates[0])

    print( getNamedDayOfWeek(argDay, argMonth, argYear) )
elif (len(args.dates) == 2):
    argMonth = int(args.dates[1])
    argYear = int(args.dates[0])

    if (HTML):
        outputCSS(MONTH[argMonth - 1] + " " + str(argYear) + " AR")

    print( calendar(argMonth) )

    if (HTML):
        outputEnd()
elif (len(args.dates) == 1):
    argYear = int(args.dates[0])

    if (HTML):
        outputCSS(str(argYear) + " AR")
    else:
        print( "====== " + str(argYear) + " AR ======\n" )


    for month in range(1, 14):
        print( calendar(month) )
        

    print( "\n" )

    if (HTML):
        outputEnd()
