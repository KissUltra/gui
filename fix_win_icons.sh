#!/bin/bash

VMNAME="Ubuntu Desktop 21"
VMUSER="fedor@192.168.2.220"
SCP="scp -i ~/.ssh/kiss_win_rsa"
SSH="ssh -i ~/.ssh/kiss_win_rsa"

function fix_icon() {
    target=${1}
    echo "Fixing icon for target ${target}"
    for f in `ls release/*-${target}.zip`; do
        file=`basename ${f}`
        echo "Fixing ${file}"
        mkdir ziptmp
        unzip ${f} -d ziptmp/
        ${SCP} images/icon_256.ico ${VMUSER}:/home/fedor/res/
        ${SCP} ziptmp/KISS\ ULTRA\ GUI/kissultra-gui.exe ${VMUSER}:/home/fedor/res/
        ${SSH} ${VMUSER} res/changeicon.sh
        ${SCP} ${VMUSER}:/home/fedor/res/kissultra-gui.exe ziptmp/KISS\ ULTRA\ GUI/
        rm -f ${f}
        cd ziptmp/
        zip -r ../${f} KISS\ ULTRA\ GUI/*
        cd ..
        rm -rf ziptmp
    done 
}

echo "Staring linux machine"
VBoxManage startvm "${VMNAME}" --type headless
sleep 30

fix_icon "win32"
fix_icon "win64"

echo "Shutting down linux machine"
VBoxManage controlvm "${VMNAME}" poweroff
