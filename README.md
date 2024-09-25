# Caption Writer
NISHI, Takao <nishi.t.es@osaka-u.ac.jp>

## What's this?
"Caption Writer" is a tool to easily create captioned image datasets for training VL models.

## Installation
### Dependency
* [Node.js](https://nodejs.org/)
  * [Electron](https://www.electronjs.org/)
  * [file-type](https://www.npmjs.com/package/file-type) (<=16.5.4)
  * [image-size](https://www.npmjs.com/package/image-size)
  * Roboto font
  * FontAwesome 6 Free

1. install node.js and npm
2. run `npm install` to install the remaining dependent libraries (electron, fontawesome-free, roboto-fontface, file-type and image-size)
3. Copy Roboto woff2 fonts to the font directory
4. Copy Fontawesome fonts to the font directory
5. Copy the Fontawesome style file to the css directory

```
$ cd Path/where/CaptionWriter/downloaded
$ npm install

# copy Robot fonts
$ cp node_modules/roboto-fontface//fonts/roboto/Roboto-Regular.woff2 ./fonts/
$ cp node_modules/roboto-fontface//fonts/roboto/Roboto-Bold.woff2 ./fonts/

# copy FontAwesome fonts
$ cp node_modules/@fortawesome/fontawesome-free/webfonts/fa-regular-400.* ./fonts/
$ cp node_modules/@fortawesome/fontawesome-free/webfonts/fa-solid-900.* ./fonts/

# copy FontAwesome style file
$ cp node_modules/@fortawesome/fontawesome-free/css/fontawesome.min.css ./css/
```

## Running
```
$ cd Path/where/CaptionWriter/downloaded
$ ./node_modules/.bin/electron .
```


## License

BSD 2-Clause "Simplified" License

See [LICENSE](./LICENSE) for details.
