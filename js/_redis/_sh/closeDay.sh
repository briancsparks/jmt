#!/usr/bin/env bash

port="$1"
db="$2"
typename="$3"
date="$4"

#port="6380"
#typename="access"
#date="2013/12/01"
#
#[ -n "$r_date" ] && date="$r_date"

rm /tmp/slug_zeros > /dev/null
touch /tmp/slug_zeros

#exit 0
rm /tmp/debug > /dev/null
touch /tmp/debug

echo "Looking for $date" >> /tmp/debug
for ((;;)); do
  [ `redis-cli -p $port SISMEMBER "${typename}:close_day:date" "$date"` == "1" ] && break
  echo "Waiting for $date" >> /tmp/debug
  sleep 1
done

echo "Done waiting!  Working on $date" >> /tmp/debug

redis-cli -p $port SMEMBERS "${typename}:field:names" | while read field; do
    redis-cli -p $port SMEMBERS "${typename}_delete_at:$date:slug" | while read sid; do
      echo "${typename}_slug:$sid:$field"
    done
  done | xargs redis-cli -p $port DEL | tee -a /tmp/debug

redis-cli -p $port SMEMBERS "${typename}:field:names" | while read field; do
    redis-cli -p $port SMEMBERS "${typename}_delete_at:$date:slug" | while read sid; do
      echo "${typename}_slug:$sid:${field}_id"
    done
  done | xargs redis-cli -p $port DEL | tee -a /tmp/debug

redis-cli -p $port SMEMBERS "${typename}:field:names" | while read field; do
    redis-cli -p $port SMEMBERS "${typename}_delete_at:$date:slug" | while read sid; do
      echo "${typename}_slug:$sid:${field}_magn"
    done
  done | xargs redis-cli -p $port DEL | tee -a /tmp/debug

echo "Finding SETS to remove slugs from... This takes a while" >> /tmp/debug
redis-cli -p $port SMEMBERS "${typename}_type_holder:slug:name" | while read kind; do
    redis-cli -p $port SMEMBERS "${typename}_type_holder:slug:$kind" | while read name; do
      printf "%d %s\n" \
        `redis-cli -p $port SDIFFSTORE "$kind:$name:${typename}_slug_" "$kind:$name:${typename}_slug_" "${typename}_delete_at:$date:slug"` \
        "$kind:$name:${typename}_slug_"
    done
  done | grep '^0 ' | cut -d' ' -f2 > /tmp/slug_zeros

echo "Cleaning up which SETS have lost all their slugs" >> /tmp/debug
  cat /tmp/slug_zeros | cut -d: -f1 | sort | uniq | while read kind; do
    grep "^$kind:" /tmp/slug_zeros | cut -d: -f2- | sed 's/:[^:]*$//g' | \
      xargs -r redis-cli -p $port SREM "${typename}_type_holder:slug:$kind"
  done

redis-cli -p $port DEL "${typename}_delete_at:$date:slug"

echo "Done!!" >> /tmp/debug


