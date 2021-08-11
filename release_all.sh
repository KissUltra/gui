#!/bin/bash

gulp release --win64
gulp release --win32
gulp release --osx64
gulp release --linux32
gulp release --linux64
gulp release --chromeos

./make_web.sh

./fix_win_icons.sh
cd sign
./notarize.sh
#./staple.sh
cd ..

./release_web.sh
