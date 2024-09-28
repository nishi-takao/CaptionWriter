"use strict";
const FS=require('node:fs');
const Path=require('path');

const Files={
    'node_modules/roboto-fontface/fonts/roboto/Roboto-Regular.woff2':
    'fonts',
    'node_modules/roboto-fontface/fonts/roboto/Roboto-Bold.woff2':
    'fonts',
    'node_modules/@fortawesome/fontawesome-free/webfonts/fa-regular-400.ttf':
    'fonts',
    'node_modules/@fortawesome/fontawesome-free/webfonts/fa-regular-400.woff2':
    'fonts',
    'node_modules/@fortawesome/fontawesome-free/webfonts/fa-solid-900.ttf':
    'fonts',
    'node_modules/@fortawesome/fontawesome-free/webfonts/fa-solid-900.woff2':
    'fonts',
    'node_modules/@fortawesome/fontawesome-free/css/fontawesome.min.css':
    'css'
};

Object.entries(Files).forEach(
    ([src,dstdir])=>{
	FS.cpSync(
	    Path.join.apply(null,src.split('/')),
	    Path.join(dstdir,Path.basename(src))
	);
    }
);
