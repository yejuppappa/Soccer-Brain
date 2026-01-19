import { useState, useEffect, useRef, useMemo } from "react";
import { MessageSquare, Send, Radio, Trophy, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSport } from "@/contexts/sport-context";
import { SportPlaceholder } from "@/components/sport-placeholder";

interface LiveMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  minute: number;
  status: 'first_half' | 'half_time' | 'second_half' | 'full_time';
  homeLogoUrl: string;
  awayLogoUrl: string;
  league: string;
}

interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: Date;
  isMe?: boolean;
}

const MOCK_LIVE_MATCHES: LiveMatch[] = [
  {
    id: "live-1",
    homeTeam: "Manchester City",
    awayTeam: "Arsenal",
    homeScore: 2,
    awayScore: 1,
    minute: 67,
    status: 'second_half',
    homeLogoUrl: "https://media.api-sports.io/football/teams/50.png",
    awayLogoUrl: "https://media.api-sports.io/football/teams/42.png",
    league: "Premier League"
  },
  {
    id: "live-2",
    homeTeam: "Liverpool",
    awayTeam: "Chelsea",
    homeScore: 0,
    awayScore: 0,
    minute: 45,
    status: 'half_time',
    homeLogoUrl: "https://media.api-sports.io/football/teams/40.png",
    awayLogoUrl: "https://media.api-sports.io/football/teams/49.png",
    league: "Premier League"
  },
  {
    id: "live-3",
    homeTeam: "Real Madrid",
    awayTeam: "Barcelona",
    homeScore: 1,
    awayScore: 2,
    minute: 32,
    status: 'first_half',
    homeLogoUrl: "https://media.api-sports.io/football/teams/541.png",
    awayLogoUrl: "https://media.api-sports.io/football/teams/529.png",
    league: "La Liga"
  }
];

const MOCK_CHAT_MESSAGES: Omit<ChatMessage, 'id' | 'timestamp'>[] = [
  { username: "축덕이", message: "골~~~~!!!! 홀란드 대박" },
  { username: "토트넘팬", message: "아스날 왜저러냐 ㅋㅋ" },
  { username: "레전드", message: "시티 오늘 컨디션 좋네" },
  { username: "EPL마니아", message: "살라 오늘 경기 어때요?" },
  { username: "챔스가자", message: "리버풀 전반 무난하네" },
  { username: "호날두7", message: "엘클라시코 진짜 불꽃이다" },
  { username: "무리뉴팬", message: "바르사 수비 뚫리네" },
  { username: "K리그러버", message: "해외축구 잼나네 ㅋㅋ" },
  { username: "분데스팬", message: "시티 역습 오졌다" },
  { username: "전술가", message: "과르디올라 전술이 먹힘" },
];

function getStatusText(status: LiveMatch['status'], minute: number): string {
  switch (status) {
    case 'first_half': return `전반 ${minute}'`;
    case 'half_time': return '하프타임';
    case 'second_half': return `후반 ${minute}'`;
    case 'full_time': return '종료';
  }
}

export default function Live() {
  const { currentSport } = useSport();
  const [matches, setMatches] = useState<LiveMatch[]>(MOCK_LIVE_MATCHES);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [selectedMatch, setSelectedMatch] = useState<string>(MOCK_LIVE_MATCHES[0].id);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const messageIdCounter = useRef(0);

  const initialMessages = useMemo(() => {
    return MOCK_CHAT_MESSAGES.slice(0, 5).map((msg, i) => ({
      ...msg,
      id: `initial-${i}`,
      timestamp: new Date(Date.now() - (5 - i) * 30000)
    }));
  }, []);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMatches(prev => prev.map(match => {
        if (match.status === 'full_time' || match.status === 'half_time') return match;
        
        const newMinute = match.minute + 1;
        let newStatus: LiveMatch['status'] = match.status;
        
        if (newMinute >= 45 && match.status === 'first_half') {
          newStatus = 'half_time';
        } else if (newMinute >= 90 && match.status === 'second_half') {
          newStatus = 'full_time';
        }
        
        return { ...match, minute: newMinute, status: newStatus };
      }));
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let msgIndex = 5;
    const interval = setInterval(() => {
      if (msgIndex < MOCK_CHAT_MESSAGES.length) {
        const newMsg: ChatMessage = {
          ...MOCK_CHAT_MESSAGES[msgIndex],
          id: `auto-${messageIdCounter.current++}`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, newMsg]);
        msgIndex++;
      } else {
        msgIndex = 0;
      }
    }, 4000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;
    
    const newMsg: ChatMessage = {
      id: `me-${messageIdCounter.current++}`,
      username: "나",
      message: inputMessage.trim(),
      timestamp: new Date(),
      isMe: true
    };
    
    setMessages(prev => [...prev, newMsg]);
    setInputMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (currentSport !== 'soccer') {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-40 bg-background border-b">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <h1 className="font-bold text-lg">광장</h1>
            </div>
            <ThemeToggle />
          </div>
        </header>
        <SportPlaceholder />
      </div>
    );
  }

  const currentMatch = matches.find(m => m.id === selectedMatch) || matches[0];

  return (
    <div className="min-h-screen bg-background pb-20 flex flex-col">
      <header className="sticky top-0 z-40 bg-background border-b">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-red-500 animate-pulse" />
            <h1 className="font-bold text-lg">광장</h1>
            <Badge variant="destructive" className="text-[10px]">LIVE</Badge>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-lg mx-auto w-full flex-1 flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium">진행 중인 경기</span>
            <Badge variant="outline" className="text-[10px]">{matches.length}경기</Badge>
          </div>
          
          <ScrollArea className="w-full">
            <div className="flex gap-3 pb-2">
              {matches.map((match) => (
                <Card 
                  key={match.id}
                  onClick={() => setSelectedMatch(match.id)}
                  className={`min-w-[200px] p-3 cursor-pointer transition-all ${
                    selectedMatch === match.id 
                      ? 'ring-2 ring-primary bg-primary/5' 
                      : 'hover-elevate'
                  }`}
                  data-testid={`card-live-match-${match.id}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-muted-foreground">{match.league}</span>
                    <div className="flex items-center gap-1">
                      {match.status !== 'full_time' && match.status !== 'half_time' && (
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      )}
                      <span className={`text-[10px] font-medium ${
                        match.status === 'half_time' ? 'text-amber-500' :
                        match.status === 'full_time' ? 'text-muted-foreground' :
                        'text-red-500'
                      }`}>
                        {getStatusText(match.status, match.minute)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-1">
                      <img src={match.homeLogoUrl} alt={match.homeTeam} className="w-6 h-6 object-contain" />
                      <span className="text-xs font-medium truncate">{match.homeTeam.slice(0, 3).toUpperCase()}</span>
                    </div>
                    
                    <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded font-bold text-sm">
                      <span className={match.homeScore > match.awayScore ? 'text-primary' : ''}>{match.homeScore}</span>
                      <span className="text-muted-foreground">-</span>
                      <span className={match.awayScore > match.homeScore ? 'text-primary' : ''}>{match.awayScore}</span>
                    </div>
                    
                    <div className="flex items-center gap-1.5 flex-1 justify-end">
                      <span className="text-xs font-medium truncate">{match.awayTeam.slice(0, 3).toUpperCase()}</span>
                      <img src={match.awayLogoUrl} alt={match.awayTeam} className="w-6 h-6 object-contain" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                {currentMatch.homeTeam} vs {currentMatch.awayTeam} 채팅방
              </span>
            </div>
          </div>
          
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3">
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex gap-2 ${msg.isMe ? 'justify-end' : ''}`}
                  data-testid={`chat-message-${msg.id}`}
                >
                  {!msg.isMe && (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                      {msg.username.slice(0, 1)}
                    </div>
                  )}
                  <div className={`max-w-[70%] ${msg.isMe ? 'order-first' : ''}`}>
                    {!msg.isMe && (
                      <span className="text-xs text-muted-foreground mb-0.5 block">{msg.username}</span>
                    )}
                    <div className={`px-3 py-2 rounded-2xl text-sm ${
                      msg.isMe 
                        ? 'bg-primary text-primary-foreground rounded-br-sm' 
                        : 'bg-muted rounded-bl-sm'
                    }`}>
                      {msg.message}
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-0.5 block">
                      {msg.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          </ScrollArea>
          
          <div className="p-3 border-t bg-background">
            <div className="flex gap-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="메시지를 입력하세요..."
                className="flex-1"
                data-testid="input-chat-message"
              />
              <Button 
                size="icon" 
                onClick={handleSendMessage}
                disabled={!inputMessage.trim()}
                data-testid="button-send-message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
