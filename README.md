# Caption Writer
NISHI, Takao <nishi.t.es@osaka-u.ac.jp>

## What's this?
"Caption Writer" is a tool to easily create captioned image datasets for training VL models.

![Screen Shot](screenshot.jpg)

It's a GUI tool, but almost all operations can be done using just the keyboard.

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

```
$ cd Path/where/CaptionWriter/downloaded
$ npm install
```

## Running
```
$ cd Path/where/CaptionWriter/downloaded
$ ./node_modules/.bin/electron .
```


## License

BSD 2-Clause "Simplified" License

See [LICENSE](./LICENSE) for details.
