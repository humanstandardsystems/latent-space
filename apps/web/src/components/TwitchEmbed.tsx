interface TwitchEmbedProps {
  channel: string;
}

export function TwitchEmbed({ channel }: TwitchEmbedProps) {
  if (!channel) return null;

  return (
    <div style={{
      position: 'absolute',
      top: 16,
      left: 16,
      width: 280,
      background: '#0a0010',
      border: '1px solid #2d1b4e',
      borderRadius: 6,
      overflow: 'hidden',
    }}>
      <iframe
        src={`https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}&muted=false`}
        height={158}
        width={280}
        frameBorder={0}
        scrolling="no"
        allowFullScreen
        title="twitch"
      />
    </div>
  );
}
