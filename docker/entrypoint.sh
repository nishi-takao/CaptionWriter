#!/bin/sh
#
#
if [ -z "${EXECUID}" ]; then
    EXECUID=1000
fi
/usr/sbin/usermod -u ${EXECUID} node &&
/usr/sbin/gosu node /bin/sh -c 'cd /home/node/app && ./node_modules/.bin/electron . -C /home/node/app/config/ -d /mnt/data/'
