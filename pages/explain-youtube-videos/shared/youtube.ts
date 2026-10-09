declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const loadPlayer = (elementID: string): Promise<YT.Player> =>
  new Promise((resolve) => {
    window.onYouTubeIframeAPIReady = () => {
      const player = new YT.Player(elementID, {
        events: { onReady: () => resolve(player) },
      });
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.append(script);
  });
