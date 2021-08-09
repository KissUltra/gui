#!/bin/bash

gulp release --win64
gulp release --win32
gulp release --osx64
gulp release --linux32
gulp release --linux64
gulp release --chromeos