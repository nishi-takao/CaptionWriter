#!/usr/bin/bash
set -e
if [ -z "$1" ]; then \
   echo "$0 SOME/WHERE/IMAGES" >& 2
   exit -1;
fi

DIRNAME="$(cd -- "$(dirname -- "$1")" && pwd)"
DATA_PATH="${DIRNAME%/}/$(basename -- "$1")"
(
cd ../ && docker run -it --rm \
       -e EXECUID=$UID \
       -e QT_X11_NO_MITSHM=1 \
       -e NO_AT_BRIDGE=1 \
       -e DISPLAY=$DISPLAY \
       -v /tmp/.X11-unix:/tmp/.X11-unix \
       -v "$HOME/.Xauthority:/home/node/.Xauthority:rw" \
       -v config:/home/node/app/config \
       -v $DATA_PATH:/mnt/data
       --network=host \
       --device /dev/dri \
       --cap-add=SYS_ADMIN \
       --security-opt seccomp=unconfined \
       capw
)
