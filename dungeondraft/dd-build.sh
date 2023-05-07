#!/bin/bash
#
# Builds a Dungeondraft asset pack.
#

die() {
    echo $@
    exit 1
}

if [ -f .env ]
then
    . .env
else
    die "Unable to find .env file"
fi

PACK_TITLE=$(echo $PACK_NAME | sed 's/-/ /g')
BUILD_PACK=$(echo $PACK_NAME | sed 's/-/ /g').dungeondraft_pack
RELEASE_PACK=$(echo $PACK_NAME | sed 's/-/_/g').dungeondraft_pack

SRC="src"
DEST="$PACK_NAME/textures"

command -v dungeondraft-pack || die "No dungeondraft-pack executable."

if [ ! -d "$SRC" ]
then
    die "No src directory found"
fi
if [ ! -f "$PACK_NAME/pack.json" ]
then
    mkdir -p releases $PACK_NAME/textures $PACK_NAME/data
    sleep 1
    dungeondraft-pack -genpack -version 0.0.0 -author "$AUTHOR" -name "$PACK_TITLE" "$PACK_NAME" releases
    echo "Created pack version 0.0.0"
    echo "Check the pack.json, and create other meta files before re-running"
    exit 0
fi

command -v gimp || die "Unable to find 'gimp'"
command -v convert || die "Unable to find 'convert'"

BASE="$(pwd)"

pushd $SRC
gimp -n -i -b - <<EOF
(let* ( (file's (cadr (file-glob "*.xcf" 1))) (filename "") (image 0) (layer 0) )
  (while (pair? file's)
    (set! image (car (gimp-file-load RUN-NONINTERACTIVE (car file's) (car file's))))
    (set! layer (car (gimp-image-merge-visible-layers image CLIP-TO-IMAGE)))
    (set! filename (string-append (substring (car file's) 0 (- (string-length (car file's)) 4)) ".png"))
    (gimp-file-save RUN-NONINTERACTIVE image layer filename filename)
    (gimp-image-delete image)
    (set! file's (cdr file's))
    )
  (gimp-quit 0)
  )
EOF
popd

cp $SRC/preview.png $DEST

for dir in $(find $SRC -mindepth 1 -type d)
do
    d=$(echo $dir | sed 's#[^/]*/##')

    echo $DEST/$d
    mkdir -p "$DEST/$d"
    pushd "$SRC/$d"

    files=$(shopt -s nullglob dotglob; echo *.xcf)
    if (( ${#files} ))
    then
gimp -n -i -b - <<EOF
(let* ( (file's (cadr (file-glob "*.xcf" 1))) (filename "") (image 0) (layer 0) )
  (while (pair? file's)
    (set! image (car (gimp-file-load RUN-NONINTERACTIVE (car file's) (car file's))))
    (set! layer (car (gimp-image-merge-visible-layers image CLIP-TO-IMAGE)))
    (set! filename (string-append (substring (car file's) 0 (- (string-length (car file's)) 4)) ".png"))
    (gimp-file-save RUN-NONINTERACTIVE image layer filename filename)
    (gimp-image-delete image)
    (set! file's (cdr file's))
    )
  (gimp-quit 0)
  )
EOF
    fi

    files=$(shopt -s nullglob dotglob; echo *.svg)
    if (( ${#files} ))
    then
        for svg in *.svg
        do
            convert -background none $svg $(echo $svg | sed 's/svg/png/g')
        done
    fi

    files=$(shopt -s nullglob dotglob; echo *.png)
    if (( ${#files} ))
    then
        mv *.png "$BASE/$DEST/$d"
    fi
    popd

done

# Increment the minor version number
PACK="$PACK_NAME/pack.json"
if [ -w "$PACK" ]
then
    command -v jq || die "No jq utility installed"
    version=$(jq -r .version $PACK)
    minor=$(echo $version | sed 's/.*\.//g')
    major=$(echo $version | sed 's/\.[0-9]*$//g')
    minor=$((minor + 1))
    newversion="$major.$minor"
    echo "Installing $newversion"
    sed -i "s/\"$version\"/\"$newversion\"/" $PACK
fi

dungeondraft-pack -overwrite -editpack "$PACK_NAME" releases

pushd releases
mv "$BUILD_PACK" "$RELEASE_PACK"
popd

exit 0

