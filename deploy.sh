#!/bin/bash
rm -rf ./dist
npm run build-locale --prod --aot 
aws s3 rm s3://www.guilhermeborgesbastos.com --recursive
aws s3 cp ./dist/en s3://www.guilhermeborgesbastos.com --recursive
aws s3 cp ./dist/pt s3://www.guilhermeborgesbastos.com --recursive