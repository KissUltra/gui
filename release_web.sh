#!/bin/bash

TMP="webtmp"
if [ -d ${TMP} ] ; then
    rm -rf ${TMP}
fi 
mkdir -p ${TMP}
gulp clean-dist
gulp dist
cp -r dist/* ${TMP}/
mv ${TMP}/main.html ${TMP}/index.html
echo "" > ${TMP}/js/chrome_serial.js
echo "" > ${TMP}/start.js
rm -f ${TMP}/package.json
rm -f ${TMP}/README.md
cp proxy.php ${TMP}/
cd  webtmp/
zip -r ../release/kissultra-gui-web.zip *
cd ..
