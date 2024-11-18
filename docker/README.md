# docker README

This is an experimental implementation of Caption Writer to run in the docker.
We have only confirmed that it can be run in the Ubuntu 22.04 environment.

## Building image
Run build.sh

```
$ ./build.sh
```

## Running
Run run.sh with path to data directory.

For example, if you want to add a caption to images in `/some/where/images`, you would do the following;

```
$ ./run.sh /some/where/images
```

When a configuration file is required,  `../config` directory with the file name `.capw`.
A last status file is also generated in the same directory.

Both the config and data directories must be readable and writable by the current executing user.
