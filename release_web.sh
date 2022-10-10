#!/bin/bash

if [[ "$1" == "DEBUG" ]] 
then
	echo "***** DEBUG MODE BUILD! *****"
	export PATH="/Library/Java/JavaVirtualMachines/jdk1.8.0_202.jdk/Contents/Home:/opt/local/bin:/opt/local/sbin:/usr/local/opt/node@10/bin:/usr/local/opt/mysql@5.7/bin:/Users/fedor/.nvm/versions/node/v16.15.1/bin:/Users/fedor/.sdkman/candidates/grails/current/bin:/Users/fedor/.sdkman/candidates/gradle/current/bin:/Library/Java/JavaVirtualMachines/jdk1.8.0_202.jdk/Contents/Home:/opt/local/bin:/opt/local/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/go/bin:/usr/local/MacGPG2/bin:/opt/X11/bin:/Library/Apple/usr/bin:/usr/local/CrossPack-AVR/bin:/Applications/Wireshark.app/Contents/MacOS:/usr/local/git/bin:/Users/fedor/Applications/gcc-arm-none-eabi-8-2018-q4-major/bin/:/Users/fedor/Applications/apache-maven-3.5.0/bin:/Users/fedor/Library/Android/sdk/platform-tools:/Users/fedor/Applications/apache-maven-3.5.0/bin/:/Users/fedor/esp/xtensa-esp32-elf/bin:/usr/local/Cellar/node/7.0.0/bin:/Users/fedor/Library/Android/sdk/platform-tools:/Users/fedor/Applications/gcc-arm-none-eabi-8-2018-q4-major/bin/:/Users/fedor/Applications/apache-maven-3.5.0/bin:/Users/fedor/Library/Android/sdk/platform-tools:/Users/fedor/Applications/apache-maven-3.5.0/bin/:/Users/fedor/esp/xtensa-esp32-elf/bin:/usr/local/Cellar/node/7.0.0/bin"
fi

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
if [[ ! "$1" == "DEBUG" ]]
then 
	cd  webtmp/
	zip -r ../release/kissultra-gui-web.zip *
	cd ..
fi
