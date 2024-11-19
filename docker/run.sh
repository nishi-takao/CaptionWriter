#!/usr/bin/bash
set -e
if [ -z "$1" ]; then \
   echo "$0 SOME/WHERE/IMAGES" >& 2
   exit -1;
fi

EXECUID=$(id -u $(who am i|cut -d ' ' -f 1))
CONF_DIR="$(dirname $(pwd))/config"
DIRNAME="$(cd -- "$(dirname -- "$1")" && pwd)"
DATA_DIR="${DIRNAME%/}/$(basename -- "$1")"

exec docker run -it --rm \
       -e EXECUID=$EXECUID \
       -e QT_X11_NO_MITSHM=1 \
       -e NO_AT_BRIDGE=1 \
       -e DISPLAY=$DISPLAY \
       -v /tmp/.X11-unix:/tmp/.X11-unix \
       -v "$HOME/.Xauthority:/home/node/.Xauthority:rw" \
       -v $CONF_DIR:/home/node/app/config \
       -v $DATA_DIR:/mnt/data \
       --network=host \
       --device /dev/dri \
       --cap-add=SYS_ADMIN \
       --security-opt seccomp=unconfined \
       capw
