#!/bin/bash
#
# Script to create tokens from a paper minis PDF.
#
# ./mktokens.sh <dirname> [<PDF name>]
#
# If <dirname> exists, assumes the PDF has had images ripped out of it and
# they exist in that directory.
#
# If it doesn't, expects a PDF file and runs pdfimages on it.
#

name="$1"

if [ ! -d "$name" ]
then
    file="$2"
    if [ ! -f "$file" ]
    then
        echo "Cannot find PDF file"
        exit 2
    fi
    mkdir "$name"
    pdfimages -all "$file" ./"$name"/ || (echo "'pdfimages' failed to run"; exit 2)
fi

cd "$name"

# First two files are normally the cover page.
rm -f -- *000.jpg *001.png
i=0
for jpg in *jpg
do
	i=$(( i + 1 ))
	png=$(printf "$name-%02d.png" $i)
	token=$(printf "$name-%02d-token.png" $i)
	convert -crop 900x900+800+50 -scale 400x400 -- $jpg $png
	convert $png ../mask.png -alpha Off -compose CopyOpacity -composite $token
	convert -scale 140x140 $token ../frame.png -composite $token
done
