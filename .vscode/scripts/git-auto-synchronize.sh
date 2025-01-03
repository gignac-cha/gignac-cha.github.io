INTERVAL=${1:-300}

CURRENT_TIME=$(date +%s)
LAST_SYNCHRONIZED_TIME_FILE=.vscode/scripts/.last-synchronized-time

if [ -f $LAST_SYNCHRONIZED_TIME_FILE ]; then
    LAST_SYNCHRONIZED_TIME=$(cat $LAST_SYNCHRONIZED_TIME_FILE)
else
    LAST_SYNCHRONIZED_TIME=0
fi

echo $CURRENT_TIME > $LAST_SYNCHRONIZED_TIME_FILE

if [ $((CURRENT_TIME - LAST_SYNCHRONIZED_TIME)) -lt $INTERVAL ]; then
    exit 0
fi

git add -A

git commit \
  -m "auto: $(date "+%Y-%m-%dT%H:%M:%S.%N") ($(git rev-parse --abbrev-ref HEAD))" \
  -m "$(git status)" \
  -m "$(git diff --stat --cached)"

git push --set-upstream origin $(git rev-parse --abbrev-ref HEAD)
