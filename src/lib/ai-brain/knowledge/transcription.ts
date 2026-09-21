export interface TranscriptResult {
  success: boolean;
  transcript?: string;
  rawCaptions?: Array<{ start: number; duration: number; text: string }>;
  metadata?: {
    title: string;
    author?: string;
    duration?: number;
    thumbnail?: string;
  };
  providerName: string;
  error?: string;
}

export interface TranscriptProvider {
  getTranscript(url: string): Promise<TranscriptResult>;
}

export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n+/g, ' ');
}

export class YouTubeTranscriptProvider implements TranscriptProvider {
  async getTranscript(url: string): Promise<TranscriptResult> {
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      return {
        success: false,
        providerName: 'YouTubeCaptionsProvider',
        error: 'URL do YouTube inválida ou não reconhecida.',
      };
    }

    try {
      // 1. Fetch oEmbed metadata for title & author
      let title = `Vídeo YouTube (${videoId})`;
      let author = 'YouTube Author';
      let thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

      try {
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json();
          title = oembedData.title || title;
          author = oembedData.author_name || author;
          thumbnail = oembedData.thumbnail_url || thumbnail;
        }
      } catch (err) {
        console.warn('oEmbed fetch warning:', err);
      }

      // 2. Fetch YouTube Watch Page HTML
      const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const pageRes = await fetch(watchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });

      if (!pageRes.ok) {
        return {
          success: false,
          providerName: 'YouTubeCaptionsProvider',
          metadata: { title, author, thumbnail },
          error: `Falha ao acessar o vídeo (${pageRes.status}).`,
        };
      }

      const html = await pageRes.text();

      // Extract captionTracks JSON
      const captionTrackMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
      if (!captionTrackMatch) {
        return {
          success: false,
          providerName: 'YouTubeCaptionsProvider',
          metadata: { title, author, thumbnail },
          error: 'Não foi possível obter a transcrição automaticamente (legendas desativadas para este vídeo).',
        };
      }

      const captionTracks = JSON.parse(captionTrackMatch[1]);
      if (!Array.isArray(captionTracks) || captionTracks.length === 0) {
        return {
          success: false,
          providerName: 'YouTubeCaptionsProvider',
          metadata: { title, author, thumbnail },
          error: 'Nenhuma faixa de legenda encontrada para este vídeo.',
        };
      }

      // Prefer Portuguese track, then English, then first available
      const track =
        captionTracks.find((t: any) => t.languageCode === 'pt' || t.languageCode?.startsWith('pt')) ||
        captionTracks.find((t: any) => t.languageCode === 'en' || t.languageCode?.startsWith('en')) ||
        captionTracks[0];

      if (!track || !track.baseUrl) {
        return {
          success: false,
          providerName: 'YouTubeCaptionsProvider',
          metadata: { title, author, thumbnail },
          error: 'Faixa de legenda sem URL de acesso.',
        };
      }

      // 3. Fetch Caption Track XML/JSON
      const captionRes = await fetch(track.baseUrl);
      const captionXml = await captionRes.text();

      // Parse XML text tags
      const textMatches = captionXml.match(/<text start="([\d.]+)" dur="([\d. ]+)"[^>]*>(.*?)<\/text>/g);
      if (!textMatches || textMatches.length === 0) {
        // Fallback for simple XML without dur attribute
        const simpleMatches = captionXml.match(/<text[^>]*>(.*?)<\/text>/g);
        if (!simpleMatches || simpleMatches.length === 0) {
          return {
            success: false,
            providerName: 'YouTubeCaptionsProvider',
            metadata: { title, author, thumbnail },
            error: 'Legenda retornou formato de texto vazio.',
          };
        }

        const fullText = simpleMatches
          .map((m) => decodeHTMLEntities(m.replace(/<[^>]+>/g, '')))
          .filter((t) => t.trim().length > 0)
          .join(' ');

        return {
          success: true,
          providerName: 'YouTubeCaptionsProvider',
          transcript: fullText,
          metadata: { title, author, thumbnail },
        };
      }

      const parsedCaptions: Array<{ start: number; duration: number; text: string }> = [];
      const lines: string[] = [];

      textMatches.forEach((item) => {
        const startMatch = item.match(/start="([\d.]+)"/);
        const durMatch = item.match(/dur="([\d.]+)"/);
        const textContent = item.replace(/<[^>]+>/g, '');
        const cleanText = decodeHTMLEntities(textContent).trim();

        if (cleanText) {
          const start = startMatch ? parseFloat(startMatch[1]) : 0;
          const duration = durMatch ? parseFloat(durMatch[1]) : 0;
          parsedCaptions.push({ start, duration, text: cleanText });
          lines.push(cleanText);
        }
      });

      const fullTranscript = lines.join(' ').replace(/\s+/g, ' ');

      return {
        success: true,
        providerName: 'YouTubeCaptionsProvider',
        transcript: fullTranscript,
        rawCaptions: parsedCaptions,
        metadata: {
          title,
          author,
          thumbnail,
          duration: parsedCaptions.length > 0 ? Math.ceil(parsedCaptions[parsedCaptions.length - 1].start) : 0,
        },
      };
    } catch (err: any) {
      console.error('Error fetching YouTube transcript:', err);
      return {
        success: false,
        providerName: 'YouTubeCaptionsProvider',
        error: `Erro ao obter transcrição do vídeo: ${err.message}`,
      };
    }
  }
}

export const youtubeTranscriptProvider = new YouTubeTranscriptProvider();
