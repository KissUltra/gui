#!/bin/bash

#gulp release --linux64 --linux32 --osx64 --win32 --win64 --chromeos
gulp release --win64
gulp release --win32
gulp release --osx64
gulp release --linux32
gulp release --linux64
gulp release --chromeos