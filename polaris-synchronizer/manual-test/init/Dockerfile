FROM alpine:3.19
RUN apk add --no-cache curl jq bash
COPY init.sh /init.sh
RUN chmod +x /init.sh
ENTRYPOINT ["/bin/bash", "/init.sh"]
