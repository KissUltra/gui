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
GA="<script async src=\"https://www.googletagmanager.com/gtag/js?id=G-942K2EY5DP\"></script><script>window.dataLayer = window.dataLayer || [];function gtag() {dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-942K2EY5DP');</script>"
sed -i '' "s@<!-- GA -->@$GA@g" ${TMP}/index.html
echo "" > ${TMP}/js/chrome_serial.js
echo "" > ${TMP}/start.js
rm -f ${TMP}/package.json
rm -f ${TMP}/README.md
cp proxy.php ${TMP}/
cd  webtmp/
zip -r ../release/kissultra-gui-web.zip *
cd ..
