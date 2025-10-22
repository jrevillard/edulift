FROM node:20

ARG TZ
ENV TZ="$TZ"

# Create workspace and config directories and set permissions
RUN mkdir -p /workspace /home/node/.claude && \
  chown -R node:node /workspace /home/node/.claude && \
  groupadd docker -g 998 || groupmod docker -g 998 && \
  usermod -aG docker node && \
  groupadd kvm -g 108 || groupmod kvm -g 108 && \
  usermod -aG kvm node && \
  groupadd render -g 109 || groupmod render -g 109 && \
  usermod -aG render node && \
  groupadd video -g 44 || groupmod video -g 44 && \
  usermod -aG video node


# Install basic development tools and iptables/ipset
RUN apt update && apt install -y less \
  git \
  procps \
  sudo \
  fzf \
  zsh \
  man-db \
  unzip \
  gnupg2 \
  gh \
  iptables \
  ipset \
  iproute2 \
  dnsutils \
  aggregate \
  jq \
  curl \
  xz-utils \
  libglu1-mesa \
  vim \
  locales \
  wmctrl \
  xdotool \
  # X11 libraries (for Android emulator)
  libx11-6 libx11-xcb1 libxcb1 libxau6 libxdmcp6 libxcb-cursor0 mesa-vulkan-drivers qtbase5-dev libqt5x11extras5 cpu-checker\
  && apt clean \
  && rm -rf /var/lib/apt/lists/*

# Configure locales
RUN sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && \
  locale-gen

# Ensure default node user has access to /usr/local/share
RUN mkdir -p /usr/local/share/npm-global && \
  chown -R node:node /usr/local/share

ARG USERNAME=node

# Pour patrol
ENV PATH="${PATH}:/home/${USERNAME}/.pub-cache/bin"

# Persist bash history.
RUN SNIPPET="export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  && mkdir /commandhistory \
  && touch /commandhistory/.bash_history \
  && chown -R $USERNAME /commandhistory

# Set `DEVCONTAINER` environment variable to help with orientation
ENV DEVCONTAINER=true

WORKDIR /workspace

RUN ARCH=$(dpkg --print-architecture) && \
  wget "https://github.com/dandavison/delta/releases/download/0.18.2/git-delta_0.18.2_${ARCH}.deb" && \
  sudo dpkg -i "git-delta_0.18.2_${ARCH}.deb" && \
  rm "git-delta_0.18.2_${ARCH}.deb"

# Set up non-root user
USER node

# Install global packages
ENV NPM_CONFIG_PREFIX=/usr/local/share/npm-global
ENV PATH=$PATH:/usr/local/share/npm-global/bin

# Set the default shell to zsh rather than sh
ENV SHELL=/bin/zsh

# Default powerline10k theme
RUN sh -c "$(wget -O- https://github.com/deluan/zsh-in-docker/releases/download/v1.2.0/zsh-in-docker.sh)" -- \
  -p git \
  -p fzf \
  -a "source /usr/share/doc/fzf/examples/key-bindings.zsh" \
  -a "source /usr/share/doc/fzf/examples/completion.zsh" \
  -a "export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  -x

# Install Claude and associated tools
RUN npm install -g @anthropic-ai/claude-code \
  && npm install -g claude-flow@alpha \
  && npm install -g ccusage \
  && npm install -g happy-coder \
  && npm install -g @musistudio/claude-code-router \
  && npm install -g @qwen-code/qwen-code@latest \
  && npm install -g firebase-tools

# Copy and set up firewall script
COPY setup-edulift-node.sh setup-edulift-sudo.sh /usr/local/bin/
USER root
RUN chmod +x /usr/local/bin/*.sh && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/setup-edulift-sudo.sh" > /etc/sudoers.d/edulift && \
  chmod 0440 /etc/sudoers.d/edulift
USER node
