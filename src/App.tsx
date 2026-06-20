/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, DragEvent, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { 
  Stethoscope, 
  Leaf, 
  Loader2, 
  AlertCircle, 
  Upload, 
  X, 
  Sparkles, 
  Clock, 
  Calendar,
  Utensils,
  BookOpen,
  Image as ImageIcon,
  Search, 
  CheckCircle2, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  Dna, 
  AlertTriangle, 
  BookMarked,
  History,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Check,
  Heart,
  FileText,
  Camera,
  RefreshCw,
  Crop,
  Bell
} from 'lucide-react';
import { DICTIONARY_ITEMS, DICTIONARY_TYPES, DictionaryItem } from './data';

export interface HistoryItem {
  id: string;
  timestamp: string;
  input: string;
  result: string;
  days: number;
  hasImage: boolean;
}

export interface SavedDietRecord {
  id: string;
  date: string; // YYYY-MM-DD
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  mealName: string;
  ingredients: string;
  rating: 'safe' | 'warning' | 'forbidden';
  score: number;
  dayCount: number;
  greenJuice: 'none' | 'juice' | 'powder';
  medication: 'none' | 'taken';
  notes?: string;
  painLevel?: number; // 1 to 5
  image?: string; // Base64 raw/preview URL or Unsplash image path of the food photo
}

function parseIngredientsFromReport(reportText: string, inputText: string, dayCount: number) {
  const combinedText = `${reportText || ''} ${inputText || ''}`.toLowerCase();
  
  // Custom context-aware checker to prevent false matches on short Korean food names
  const isIngredientMatched = (text: string, ingredientName: string): boolean => {
    if (!text.includes(ingredientName)) return false;

    // Single character checkers (Korean foods are often represented as a single character, prone to subword mismatches)
    if (ingredientName.length === 1) {
      const char = ingredientName;
      const isKorean = (c: string) => {
        if (!c) return false;
        const code = c.charCodeAt(0);
        return code >= 0xac00 && code <= 0xd7a3;
      };

      let index = text.indexOf(char);
      while (index !== -1) {
        const prevChar = index > 0 ? text[index - 1] : '';
        const nextChar = index < text.length - 1 ? text[index + 1] : '';

        let matched = false;

        if (char === '조') {
          // '조' (foxtail millet grain) - NOT '건조', '양조', '조개', '조리', '조미료', '조기', '제조', '구조'
          const isStandalone = !isKorean(prevChar) && !isKorean(nextChar);
          const isJoBap = !isKorean(prevChar) && nextChar === '밥'; // 조밥
          if (isStandalone || isJoBap) matched = true;
        } 
        else if (char === '마') {
          // '마' (yam) - NOT '고구마', '토마토', '마늘', '이마', '안마'
          const isStandalone = !isKorean(prevChar) && !isKorean(nextChar);
          const isMaJuiceOrPorridge = !isKorean(prevChar) && (nextChar === '즙' || nextChar === '죽');
          const isChamMa = prevChar === '참' && !isKorean(nextChar); // 참마
          
          const beforePrev = index > 1 ? text[index - 2] : '';
          const isSweetPotato = (prevChar === '우' && beforePrev === '구') || (prevChar === '구' && beforePrev === '고');
          const isTomato = prevChar === '토' && nextChar === '토';

          if ((isStandalone || isMaJuiceOrPorridge || isChamMa) && !isSweetPotato && !isTomato && nextChar !== '늘') {
            matched = true;
          }
        } 
        else if (char === '김') {
          // '김' (seaweed) - NOT '김치', '튀김', '생김새'
          const isStandalone = !isKorean(prevChar) && !isKorean(nextChar);
          const isCompoundSeaweed = (prevChar === '돌' || prevChar === '래' || prevChar === '미') && !isKorean(nextChar); // 돌김, 파래김, 조미김
          const isSeaweedDish = !isKorean(prevChar) && (nextChar === '가' || nextChar === '구' || nextChar === '밥'); // 김가루, 김구이, 김밥
          
          if ((isStandalone || isCompoundSeaweed || isSeaweedDish) && nextChar !== '치' && prevChar !== '튀') {
            matched = true;
          }
        } 
        else if (char === '밤') {
          // '밤' (chestnut) - NOT '밤새', '방법', '밤하늘'
          const isStandalone = !isKorean(prevChar) && !isKorean(nextChar);
          const isChestnutPrefix = (prevChar === '군' || prevChar === '찐' || prevChar === '생' || prevChar === '알') && !isKorean(nextChar); // 군밤, 찐밤, 생밤, 알밤
          if (isStandalone || isChestnutPrefix) matched = true;
        } 
        else if (char === '잣') {
          // '잣' (pine nut) - NOT '잣대'
          const isStandalone = !isKorean(prevChar) && !isKorean(nextChar);
          const isFood = !isKorean(prevChar) && (nextChar === '죽' || nextChar === '가'); // 잣죽, 잣가루
          if (isStandalone || isFood) matched = true;
        } 
        else if (char === '파') {
          // '파' (green onion) - NOT '파스타', '스파게티', '파이', '파파야'
          const isStandalone = !isKorean(prevChar) && !isKorean(nextChar);
          const isGreenOnionType = (prevChar === '대' || prevChar === '쪽' || prevChar === '실') && !isKorean(nextChar); // 대파, 쪽파, 실파
          if ((isStandalone || isGreenOnionType) && nextChar !== '스' && nextChar !== '이' && nextChar !== '파' && prevChar !== '양') {
            matched = true;
          }
        } 
        else if (char === '쑥') {
          // '쑥' (mugwort) - NOT '쑥갓'
          const isStandalone = !isKorean(prevChar) && !isKorean(nextChar);
          const isSsukFood = !isKorean(prevChar) && (nextChar === '떡' || nextChar === '즙' || nextChar === '차');
          if ((isStandalone || isSsukFood) && nextChar !== '갓') {
            matched = true;
          }
        } 
        else if (char === '감') {
          // '감' (persimmon) - NOT '감자', '감식초', '식감', '질감', '감사'
          const isStandalone = !isKorean(prevChar) && !isKorean(nextChar);
          const isPersimmonType = prevChar === '단' && !isKorean(nextChar); // 단감
          if ((isStandalone || isPersimmonType) && nextChar !== '자' && nextChar !== '식' && prevChar !== '식' && nextChar !== '사') {
            matched = true;
          }
        } 
        else if (char === '배') {
          // '배' (pear) - NOT '양배추', '배추', '배달'
          const isStandalone = !isKorean(prevChar) && !isKorean(nextChar);
          const isPearType = (prevChar === '돌' && !isKorean(nextChar)) || (!isKorean(prevChar) && nextChar === '즙'); // 돌배, 배즙
          if ((isStandalone || isPearType) && nextChar !== '추' && nextChar !== '달' && prevChar !== '양') {
            matched = true;
          }
        } 
        else if (char === '굴') {
          // '굴' (oyster) - NOT '얼굴', '동굴', '굴러', '굴레'
          const isStandalone = !isKorean(prevChar) && !isKorean(nextChar);
          const isOysterFood = (prevChar === '생' || prevChar === '석' || !isKorean(prevChar)) && (nextChar === '구' || nextChar === '무' || nextChar === '소'); // 생굴, 석굴, 굴소스, 굴무침, 굴구이
          if ((isStandalone || isOysterFood) && prevChar !== '얼' && prevChar !== '동' && nextChar !== '러' && nextChar !== '레') {
            matched = true;
          }
        }
        else {
          // Any other single character must be strictly standalone
          if (!isKorean(prevChar) && !isKorean(nextChar)) {
            matched = true;
          }
        }

        if (matched) return true;
        index = text.indexOf(char, index + 1);
      }
      return false;
    }

    // Larger words: ensure we don't accidentally match subwords from completely different compound names
    return text.includes(ingredientName);
  };

  // Find all matched dictionary items
  const foundItems = DICTIONARY_ITEMS.filter(item => {
    const lowerName = item.name.toLowerCase();
    
    // Check for exact word or substring match safely
    if (isIngredientMatched(combinedText, lowerName)) {
      if (lowerName.includes('쇠고기') || lowerName.includes('소고기')) {
        return true;
      }
      return true;
    }
    
    // Custom synonyms
    if (lowerName === '달걀' && (combinedText.includes('달걀') || combinedText.includes('계란') || combinedText.includes('지단') || combinedText.includes('전란'))) return true;
    if (lowerName === '멥쌀(백미)' && (combinedText.includes('쌀밥') || combinedText.includes('백미') || combinedText.includes('멥쌀'))) return true;
    if (lowerName === '밀가루' && (combinedText.includes('밀가루') || combinedText.includes('국수') || combinedText.includes('라면') || combinedText.includes('파스타') || combinedText.includes('우동') || combinedText.includes('빵'))) return true;
    if (lowerName.includes('커피') && (combinedText.includes('커피') || combinedText.includes('디카페인') || combinedText.includes('아메리카노') || combinedText.includes('라떼') || combinedText.includes('에스프레소'))) return true;
    
    return false;
  });

  const specificItems = foundItems.filter(i => i.category === 'specific');
  const goodItems = foundItems.filter(i => i.category === 'good');
  const normalItems = foundItems.filter(i => i.category === 'normal');
  const forbiddenItems = foundItems.filter(i => i.category === 'forbidden');

  const specificCount = specificItems.length;
  const goodCount = goodItems.length;
  const normalCount = normalItems.length;
  const forbiddenCount = forbiddenItems.length;

  let score = 100;
  
  if (forbiddenCount > 0) {
    score = Math.max(5, 30 - forbiddenCount * 8); 
  } else if (normalCount > 0) {
    score = Math.max(50, 75 - normalCount * 5);
  } else {
    const totalSafe = specificCount + goodCount;
    if (totalSafe > 0) {
      score = Math.min(100, 90 + totalSafe * 2);
    } else {
      score = 95;
    }
  }

  // Handle explicit report text overrides
  if (reportText.includes('[🍏 안전]')) {
    score = Math.max(score, 90);
  } else if (reportText.includes('[⚠️ 섭취 불가]')) {
    score = Math.min(score, 15);
  } else if (reportText.includes('[💡 주의 필요]')) {
    score = Math.min(Math.max(score, 50), 75);
  }

  return {
    specificList: Array.from(new Set(specificItems.map(i => i.name))),
    goodList: Array.from(new Set(goodItems.map(i => i.name))),
    normalList: Array.from(new Set(normalItems.map(i => i.name))),
    forbiddenList: Array.from(new Set(forbiddenItems.map(i => i.name))),
    specificCount,
    goodCount,
    normalCount,
    forbiddenCount,
    score
  };
}

const getDaysAgoDateString = (daysAgo: number): string => {
  try {
    const target = new Date();
    target.setDate(target.getDate() - daysAgo + 1);
    const y = target.getFullYear();
    const m = String(target.getMonth() + 1).padStart(2, '0');
    const d = String(target.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  } catch {
    return '2026-05-16';
  }
};

export default function App() {
  const [input, setInput] = useState('');
  
  // 치료 시작일 상태 (기본값은 오늘 기준 30일 차가 되도록 자동 계산)
  const [startDate, setStartDate] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('ebm_treatment_start_date');
      if (saved) return saved;
      return getDaysAgoDateString(30);
    } catch {
      return '2026-05-16';
    }
  });

  const [days, setDays] = useState<number>(30); // 기본값 30일차

  useEffect(() => {
    try {
      localStorage.setItem('ebm_treatment_start_date', startDate);
      const start = new Date(startDate);
      const today = new Date();
      start.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      
      const diffTime = today.getTime() - start.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      setDays(diffDays > 0 ? diffDays : 1);
    } catch (e) {
      console.error('Error calculating treatment days:', e);
    }
  }, [startDate]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // 실시간 카메라 기능 상태
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 컴포넌트 언마운트 시 또는 스트림 변경 시 카메라 정리 cleanup
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  // 캘린더 / 식단 기록 관리 상태
  const [savedRecords, setSavedRecords] = useState<SavedDietRecord[]>(() => {
    try {
      const saved = localStorage.getItem('ebm_saved_diet_records');
      if (saved) return JSON.parse(saved);
      
      // Default mock records centered around 2026-06-14 (Sunday)
      const defaultRecords: SavedDietRecord[] = [
        {
          id: 'mock-1',
          date: '2026-06-12',
          mealType: 'breakfast',
          mealName: '현미밥과 숭어구이, 당근 샐러드',
          ingredients: '멥쌀현미, 숭어, 당근, 올리브유, 천일염',
          rating: 'safe',
          score: 100,
          dayCount: 30,
          greenJuice: 'juice',
          medication: 'taken',
          painLevel: 1,
          notes: '컨디션 최상, 관절 아침 붓기 현저히 감소함. 소금과 올리브유 소량만 넣어 안전하게 조리함.',
          image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80'
        },
        {
          id: 'mock-2',
          date: '2026-06-13',
          mealType: 'lunch',
          mealName: '백미밥과 조기 매운탕',
          ingredients: '멥쌀(백미), 무, 파, 조기 (금기 바다생선!)',
          rating: 'forbidden',
          score: 15,
          dayCount: 30,
          greenJuice: 'none',
          medication: 'taken',
          painLevel: 3,
          notes: '바다생선 조기를 섭취하였더니 다음 날 약간의 욱신욱신 수치 동반. 조기는 EBM 강력 금기이므로 철저 제한 요망.',
          image: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=600&auto=format&fit=crop&q=80'
        },
        {
          id: 'mock-3',
          date: '2026-06-14',
          mealType: 'dinner',
          mealName: '감 배 샐러드와 된장찌개 외식',
          ingredients: '감, 배, 된장, 간장, 들기름 (전부 강력 금기!!)',
          rating: 'forbidden',
          score: 5,
          dayCount: 30,
          greenJuice: 'powder',
          medication: 'none',
          painLevel: 4,
          notes: '통증 상향. 외식 메뉴에 콩기름, 간장, 된장이 모두 유입된 것을 알고 충격받음. 금기 과일인 배와 감을 섭취함.',
          image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&auto=format&fit=crop&q=80'
        }
      ];
      localStorage.setItem('ebm_saved_diet_records', JSON.stringify(defaultRecords));
      return defaultRecords;
    } catch {
      return [];
    }
  });

  const [selectedDate, setSelectedDate] = useState<string>('2026-06-14'); // YYYY-MM-DD
  const [calendarView, setCalendarView] = useState<'weekly' | 'monthly' | 'gallery'>('weekly');
  const [copiedRecordId, setCopiedRecordId] = useState<string | null>(null);
  
  // 식단 직접 등록 폼 상태
  const [showAddForm, setShowAddForm] = useState(false);
  const [formMealType, setFormMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('breakfast');
  const [formMealName, setFormMealName] = useState('');
  const [formGreenJuice, setFormGreenJuice] = useState<'none' | 'juice' | 'powder'>('none');
  const [formMedication, setFormMedication] = useState<'none' | 'taken'>('none');
  const [formPainLevel, setFormPainLevel] = useState<number>(1);
  const [formNotes, setFormNotes] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);
  
  // 식단 갤러리 필터링 상태 추가
  const [galleryRatingFilter, setGalleryRatingFilter] = useState<'all' | 'safe' | 'warning' | 'forbidden'>('all');
  const [galleryMealFilter, setGalleryMealFilter] = useState<'all' | 'breakfast' | 'lunch' | 'dinner' | 'snack'>('all');
  const [gallerySearchQuery, setGallerySearchQuery] = useState('');
  const [activeGalleryModalRecord, setActiveGalleryModalRecord] = useState<SavedDietRecord | null>(null);
  
  // 이미지 자르기(Cropping) 상태
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [cropX, setCropX] = useState<number>(15); // x offset % (0-100)
  const [cropY, setCropY] = useState<number>(15); // y offset % (0-100)
  const [cropWidth, setCropWidth] = useState<number>(70); // width % (10-100)
  const [cropHeight, setCropHeight] = useState<number>(70); // height % (10-100)

  // 브라우저 Notification 설정 상태
  const [notificationEnabled, setNotificationEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ebm_notification_enabled');
      return saved === 'true';
    } catch {
      return false;
    }
  });
  
  // History states
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('ebm_analysis_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  // Dictionary states
  const [showDict, setShowDict] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [catFilter, setCatFilter] = useState<'all' | 'specific' | 'good' | 'normal' | 'forbidden'>('all');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 캘린더 날짜 계산 관련 함수들
  const getWeekDays = (dateStr: string): Date[] => {
    const current = new Date(dateStr);
    const day = current.getDay(); // 0 is Sun, 1 is Mon, etc.
    const diff = current.getDate() - day; // Adjust to Sunday as start
    const sunday = new Date(current.setDate(diff));
    
    const daysArr: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const next = new Date(sunday);
      next.setDate(sunday.getDate() + i);
      daysArr.push(next);
    }
    return daysArr;
  };

  const getMonthDaysGrid = (year: number, month: number): (Date | null)[] => {
    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay(); // 0 (Sun) to 6 (Sat)
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();
    
    const grid: (Date | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      grid.push(null);
    }
    for (let d = 1; d <= totalDays; d++) {
      grid.push(new Date(year, month, d));
    }
    return grid;
  };

  const formatDateStr = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getDayLabel = (dayIndex: number): string => {
    const labels = ['일', '월', '화', '수', '목', '금', '토'];
    return labels[dayIndex];
  };

  const generateCopyText = (record: SavedDietRecord) => {
    const ratingEmoji = record.rating === 'safe' ? '🍏 안전' : record.rating === 'warning' ? '💡 주의 필요' : '⚠️ 섭취 불가';
    const greenJuiceStr = record.greenJuice === 'juice' ? '■ 녹즙 복용' : record.greenJuice === 'powder' ? '■ 녹즙가루 복용' : '■ 미복용';
    const medicationStr = record.medication === 'taken' ? '■ 복용' : '■ 미복용';
    const painRating = '★'.repeat(record.painLevel || 1) + '☆'.repeat(5 - (record.painLevel || 1));
    
    return `📅 [날짜/시간] ${record.date} (실시간 기록 자동 동기화)
🍽️ [식사구분] ${record.mealType === 'breakfast' ? '■ 아침' : record.mealType === 'lunch' ? '■ 점심' : record.mealType === 'dinner' ? '■ 저녁' : '■ 간식'}
🥤 [녹즙여부] ${greenJuiceStr}
📍 [식사장소] ■ 집 / □ 외식
🍱 [식사메뉴] ${record.mealName}
🌾 [주요재료] ${record.ingredients || '분석된 안심 식재료'}
⚖️ [섭 취 량] ■ 보통 / □ 과식 / □ 소식
💊 [약물/EBM제품] ${medicationStr}
📋 [안전판정] ${ratingEmoji} (체질안심도: ${record.score}%)
🩹 [특이사항] (통증수치: ${painRating} / ${record.notes || '기타 컨디션 양호'})
🏃‍♂️ [운동기록] 숲길 가벼운 산책 20분
🙏 [감사한일] 올바른 생태 유전체 식사로 보영님의 관절 건강을 지키게 되어 감사합니다!`;
  };

  const handleCopyRecord = (record: SavedDietRecord) => {
    const text = generateCopyText(record);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedRecordId(record.id);
      setTimeout(() => setCopiedRecordId(null), 2000);
    }).catch(err => {
      console.error(err);
    });
  };

  const handleDeleteRecord = (id: string) => {
    setSavedRecords(prev => {
      const updated = prev.filter(r => r.id !== id);
      try {
        localStorage.setItem('ebm_saved_diet_records', JSON.stringify(updated));
      } catch (e) {
        console.warn('LocalStorage access blocked:', e);
      }
      return updated;
    });
    setSuccessToast('🗑️ 식단 기록이 일지에서 정상 삭제되었습니다.');
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const handleLoadRecord = (record: SavedDietRecord) => {
    setInput(record.mealName);
    setStartDate(getDaysAgoDateString(record.dayCount));
    setSuccessToast('📂 선택한 식단 정보가 상단 입력창으로 동기화되었습니다!');
    setTimeout(() => setSuccessToast(null), 4000);
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  const handleSaveAnalysisToDiary = () => {
    if (!result) return;
    const analysisObj = parseIngredientsFromReport(result, input, days);
    
    let synthesizedName = '';
    if (input.trim()) {
      synthesizedName = input.trim().split('\n')[0].substring(0, 35);
    } else {
      synthesizedName = '스캔 분석된 EBM 식단';
    }

    let ebmRating: 'safe' | 'warning' | 'forbidden' = 'safe';
    if (analysisObj.forbiddenCount > 0 || result.includes('[⚠️ 섭취 불가]')) {
      ebmRating = 'forbidden';
    } else if (analysisObj.normalCount > 0 || result.includes('[💡 주의 필요]')) {
      ebmRating = 'warning';
    }

    const matchedIngs = [
      ...analysisObj.specificList,
      ...analysisObj.goodList,
      ...analysisObj.normalList,
      ...analysisObj.forbiddenList
    ].join(', ');

    const newRecord: SavedDietRecord = {
      id: Date.now().toString(),
      date: selectedDate,
      mealType: formMealType,
      mealName: formMealName || synthesizedName,
      ingredients: matchedIngs || '분석 완료된 건강 성분',
      rating: ebmRating,
      score: analysisObj.score,
      dayCount: days,
      greenJuice: formGreenJuice,
      medication: formMedication,
      painLevel: formPainLevel,
      notes: formNotes || `${days}일 차 체질 맞춤 분석 데이터 자동 연동기록`,
      image: imagePreview || undefined
    };

    setSavedRecords(prev => {
      const updated = [newRecord, ...prev];
      try {
        localStorage.setItem('ebm_saved_diet_records', JSON.stringify(updated));
      } catch (e) {
        console.warn('LocalStorage access blocked:', e);
      }
      return updated;
    });

    setFormMealName('');
    setFormNotes('');
    
    setSuccessToast(`🎉 ${selectedDate} 식단 일지에 안전하게 저장되었습니다!`);
    setTimeout(() => setSuccessToast(null), 3500);

    // Trigger Notification if contains forbidden food
    checkAndTriggerNotification(newRecord);

    setTimeout(() => {
      document.getElementById('calendar-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 200);
  };

  const handleDirectManualSave = () => {
    if (!formMealName.trim()) {
      setSuccessToast('⚠️ 저장하시려는 음식/식사명을 입력해 주세요.');
      setTimeout(() => setSuccessToast(null), 4000);
      return;
    }

    const analysisObj = parseIngredientsFromReport('', formMealName, days);
    
    let ebmRating: 'safe' | 'warning' | 'forbidden' = 'safe';
    if (analysisObj.forbiddenCount > 0) {
      ebmRating = 'forbidden';
    } else if (analysisObj.normalCount > 0) {
      ebmRating = 'warning';
    }

    const matchedIngs = [
      ...analysisObj.specificList,
      ...analysisObj.goodList,
      ...analysisObj.normalList,
      ...analysisObj.forbiddenList
    ].join(', ');

    const newRecord: SavedDietRecord = {
      id: Date.now().toString(),
      date: selectedDate,
      mealType: formMealType,
      mealName: formMealName,
      ingredients: matchedIngs || '사전 매핑 식재료',
      rating: ebmRating,
      score: analysisObj.score,
      dayCount: days,
      greenJuice: formGreenJuice,
      medication: formMedication,
      painLevel: formPainLevel,
      notes: formNotes || '간편 수기 건강 기록',
      image: imagePreview || undefined
    };

    setSavedRecords(prev => {
      const updated = [newRecord, ...prev];
      try {
        localStorage.setItem('ebm_saved_diet_records', JSON.stringify(updated));
      } catch (e) {
        console.warn('LocalStorage access blocked:', e);
      }
      return updated;
    });

    setFormMealName('');
    setFormNotes('');
    setShowAddForm(false);

    setSuccessToast(`📝 ${selectedDate} 식사 기록이 직접 등록되었습니다.`);
    setTimeout(() => setSuccessToast(null), 3000);

    // Trigger Notification if contains forbidden food
    checkAndTriggerNotification(newRecord);
  };

  const checkAndTriggerNotification = (record: SavedDietRecord) => {
    if (record.rating === 'forbidden' && notificationEnabled) {
      try {
        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (Notification.permission === 'granted') {
            new Notification('⚠️ 금기 식품 안전 감지 경고', {
              body: `보영님, 식단 [${record.mealName}]에 금기 식품이 감지되었습니다! 관절 건강을 위해 섭취하지 않도록 절대 주의해 주세요.`,
              requireInteraction: true
            });
          }
        }
      } catch (err) {
        console.warn('Iframe blocked access to Notification API properties:', err);
      }
    }
  };

  const handleToggleNotification = async (enabled: boolean) => {
    if (!enabled) {
      setNotificationEnabled(false);
      try {
        localStorage.setItem('ebm_notification_enabled', 'false');
      } catch (e) {
        console.warn(e);
      }
      setSuccessToast('🔔 브라우저 알림 설정이 비활성화되었습니다.');
      setTimeout(() => setSuccessToast(null), 3000);
      return;
    }

    try {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        setSuccessToast('⚠️ 지원하지 않는 기기/브라우저이거나, iframe 권한 제한 상태입니다.');
        setTimeout(() => setSuccessToast(null), 4000);
        return;
      }

      let currentPermission = 'default';
      try {
        currentPermission = Notification.permission;
      } catch (secErr) {
        console.warn('Notification permission read failed (sandbox active):', secErr);
        throw new Error('보안 정책 또는 iframe 제한으로 인해 실시간 브라우저 알림 기능을 시작해볼 수 없었습니다. 우측 상단의 [새 탭에서 열기] 버튼으로 실행해주시기 바랍니다.');
      }

      if (currentPermission === 'denied') {
        setSuccessToast('⚠️ 알림 권한이 거부된 상태입니다. 브라우저 주소창 왼쪽 자물쇠 아이콘에서 알림 권한을 초기화/허용하고 다시 실행해 주세요.');
        setTimeout(() => setSuccessToast(null), 5000);
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationEnabled(true);
        localStorage.setItem('ebm_notification_enabled', 'true');
        
        // Instant test notification
        try {
          new Notification('🔔 EBM 생태 알림 서비스 활성화', {
            body: '보영님, 식단 일지 등록 시 금기(섭취 불가) 재료가 매핑되면 즉각 브라우저 알림 팝업으로 경고해 드립니다!',
          });
        } catch (err) {
          console.warn(err);
        }

        setSuccessToast('🍏 브라우저 실시간 알림 서비스가 활성화되었습니다!');
        setTimeout(() => setSuccessToast(null), 4000);
      } else {
        setNotificationEnabled(false);
        localStorage.setItem('ebm_notification_enabled', 'false');
        setSuccessToast('⚠️ 알림 권한이 거부되었습니다. 브라우저 주소창 왼쪽 자물쇠 아이콘에서 알림을 허용해 주세요.');
        setTimeout(() => setSuccessToast(null), 4000);
      }
    } catch (err: any) {
      console.error('Notification request error:', err);
      setSuccessToast(err.message || '⚠️ iframe 샌드박스로 인해 알림 사용이 제한되었습니다. 우측 상단의 [새 탭에서 열기] 아이콘 클릭 후 실행해 주시기 바랍니다.');
      setTimeout(() => setSuccessToast(null), 5000);
    }
  };

  // File to base64 conversion
  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const resultStr = reader.result as string;
        // Strip out the data url scheme (e.g. "data:image/png;base64,")
        const base64Data = resultStr.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  // 실시간 카메라 기능 정의
  const startCamera = async (facingModeOverride?: 'user' | 'environment') => {
    setIsCameraActive(true);
    setCameraError(null);
    const mode = facingModeOverride || cameraFacingMode;
    try {
      // 기존 스트림 제거
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error('Camera open error:', err);
      setCameraError('실시간 카메라 가동에 실패했습니다. 브라우저/기기의 카메라 권한 허용 상태를 점검하시거나, 우회적으로 파일 업로드 단추를 눌러 "직접 촬영"을 선택해 주세요.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
    setCameraError(null);
  };

  const captureSelfieAndAnalyze = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        
        setImagePreview(dataUrl);
        const base64Data = dataUrl.split(',')[1];
        setImageBase64(base64Data);
        setImageMime('image/jpeg');
        setImageFile(null); // Direct canvas source
        
        stopCamera();
        setSuccessToast('📸 실시간 촬영 이미지가 안전하게 등록되었습니다!');
        setTimeout(() => setSuccessToast(null), 3000);
      }
    }
  };

  const handleFileChange = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있습니다.');
      return;
    }
    setError(null);
    setImageFile(file);

    // Create local preview URL
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    try {
      const base64 = await convertFileToBase64(file);
      setImageBase64(base64);
      setImageMime(file.type);
    } catch (err) {
      setError('이미지를 처리하는 동안 오류가 발생했습니다.');
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFileChange(files[0]);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageBase64(null);
    setImageMime(null);
    stopCamera();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCropComplete = () => {
    if (!imagePreview) return;
    
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const sourceX = (cropX / 100) * img.naturalWidth;
      const sourceY = (cropY / 100) * img.naturalHeight;
      const sourceWidth = (cropWidth / 100) * img.naturalWidth;
      const sourceHeight = (cropHeight / 100) * img.naturalHeight;
      
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;
      
      ctx.drawImage(
        img,
        sourceX, sourceY, sourceWidth, sourceHeight,
        0, 0, sourceWidth, sourceHeight
      );
      
      try {
        const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setImagePreview(croppedDataUrl);
        
        const base64Data = croppedDataUrl.split(',')[1];
        setImageBase64(base64Data);
        setImageMime('image/jpeg');
        
        setIsCropModalOpen(false);
        setSuccessToast('원재료 포장지 사진이 선택 영역으로 정밀 자르기 되었습니다.');
        setTimeout(() => setSuccessToast(null), 3500);
      } catch (err) {
        console.error('Error cropping image:', err);
      }
    };
    img.src = imagePreview;
  };

  // Drag & Drop handlers
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileChange(files[0]);
    }
  };

  const handleAnalyze = async () => {
    const trimmedText = input.trim();
    if (!trimmedText && !imageBase64) {
      setError('식품 정보(텍스트)를 작성하거나 포장지 사진을 등록해 주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload: any = {
        text: trimmedText,
        days: days
      };

      if (imageBase64 && imageMime) {
        payload.image = {
          data: imageBase64,
          mimeType: imageMime
        };
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '성분 분석 중 오류가 발생했습니다.');
      }

      setResult(data.result);

      // Save to history
      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleString('ko-KR', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        input: trimmedText || '포장지 및 성분 사진 분석',
        result: data.result,
        days: days,
        hasImage: !!imageBase64
      };

      setHistory(prev => {
        // Keep unique by matching input or just append and slice to 3
        const updated = [newHistoryItem, ...prev].slice(0, 3);
        try {
          localStorage.setItem('ebm_analysis_history', JSON.stringify(updated));
        } catch (e) {
          console.error(e);
        }
        return updated;
      });
    } catch (err: any) {
      setError(err.message || '네트워크 통신 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // Filter dictionary items
  const filteredItems = DICTIONARY_ITEMS.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (item.desc && item.desc.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    const matchesCat = catFilter === 'all' || item.category === catFilter;
    return matchesSearch && matchesType && matchesCat;
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50/50 via-slate-50 to-slate-100 text-slate-900 selection:bg-teal-200">
      <main className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12">
        
        {/* Header Section */}
        <header className="mb-6 text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-6 bg-white p-5 md:p-8 rounded-3xl border border-slate-200/50 shadow-sm animate-in fade-in duration-500">
          <div className="max-w-xl">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-3">
              <div className="bg-teal-600 p-2 rounded-2xl shadow-sm shadow-teal-600/20">
                <Leaf className="w-4 h-4 text-white animate-pulse" />
              </div>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full">
                신보영 님 맞춤 관리 솔루션
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-slate-800 mb-2 leading-tight">
              생태 유전체 맞춤 식단 분석 비서
            </h1>
            <p className="text-slate-500 leading-relaxed text-xs sm:text-sm md:text-base">
              사용자가 외식 메뉴나 가공식품 원재료 표기, 사진을 입력하면 보영님의 생태 체질 식단 규정과 치료 경과(일수)를 면밀하게 체크해 안전성을 한눈에 판정합니다.
            </p>
          </div>
          <div className="flex h-20 w-20 md:h-24 md:w-24 bg-teal-50/70 border border-teal-100 items-center justify-center rounded-3xl flex-shrink-0 shadow-inner">
            <Stethoscope className="w-8 h-8 md:w-10 h-10 text-teal-600" />
          </div>
        </header>

        {/* Therapy Settings Box */}
        <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200/60 shadow-sm mb-6">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
            <Clock className="w-4 h-4 text-teal-600" />
            <h2 className="font-extrabold text-slate-800 text-sm sm:text-base">치료 경과 설정</h2>
            <span className="text-[10px] text-slate-400 font-semibold ml-1.5 hidden sm:inline">치료 시작일을 지정하시면 경과 일수가 자동으로 연동 계산됩니다.</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Start Date Input and Computed Display */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <span className="text-sm font-semibold text-slate-600">📅 치료 시작일 기입</span>
                <input 
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-teal-50/50 border border-teal-100 px-3 py-1.5 rounded-xl text-sm font-bold text-teal-700 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all cursor-pointer"
                />
              </div>
              <div className="bg-gradient-to-r from-teal-50 to-emerald-50 rounded-2xl p-4 border border-teal-100/50 flex items-center justify-between shadow-xs">
                <span className="text-xs font-bold text-slate-500">현재 계산된 경과 상태:</span>
                <span className="text-sm font-extrabold text-teal-800 bg-white px-3 py-1.5 rounded-xl shadow-sm border border-teal-100 flex items-center gap-1.5 animate-pulse">
                  🌱 치료 <span className="text-base text-teal-600 font-black">{days}</span>일 차
                </span>
              </div>
            </div>

            {/* Quick selectors that calculate start dates */}
            <div>
              <span className="block text-[10px] sm:text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">간편 설정 모드 (시작일 자동 지정)</span>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                <button 
                  onClick={() => setStartDate(getDaysAgoDateString(30))}
                  className={`flex-1 px-2.5 py-2 rounded-xl border text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                    days === 30 
                      ? 'bg-teal-600 border-teal-600 text-white shadow-xs' 
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-105'
                  }`}
                >
                  🐣 초기 (30일 차)
                </button>
                <button 
                  onClick={() => setStartDate(getDaysAgoDateString(60))}
                  className={`flex-1 px-2.5 py-2 rounded-xl border text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                    days === 60 
                      ? 'bg-teal-600 border-teal-600 text-white shadow-xs' 
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-105'
                  }`}
                >
                  🌿 집중 (60일 차)
                </button>
                <button 
                  onClick={() => setStartDate(getDaysAgoDateString(100))}
                  className={`flex-1 px-2.5 py-2 rounded-xl border text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                    days === 100 
                      ? 'bg-teal-600 border-teal-600 text-white shadow-xs' 
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-105'
                  }`}
                >
                  🍏 해제 (100일 차)
                </button>
              </div>
            </div>
          </div>

          {/* Web Notifications Feature Toggler */}
          <div className="mt-5 pt-4 border-t border-dashed border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/20">
            <div className="flex items-start sm:items-center gap-3">
              <span className="p-2 bg-rose-50 border border-rose-100 text-rose-500 rounded-xl flex-shrink-0">
                <Bell className="w-4 h-4 animate-bounce" style={{ animationDuration: '3s' }} />
              </span>
              <div>
                <h3 className="font-extrabold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
                  금기 식품 등록 실시간 브라우저 알림 (Notification API)
                  {notificationEnabled && (
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  )}
                </h3>
                <p className="text-[10px] sm:text-xs text-slate-500 mt-1 leading-relaxed">
                  치료 일지에 <strong>금기 식품(섭취 불가)</strong>이 포함된 식단을 분석하거나 직접 기록할 때, 브라우저가 위험 경고 푸시 알림을 즉시 팝업으로 발송합니다.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 mt-2 sm:mt-0 flex-shrink-0 bg-white border border-slate-200/60 p-1.5 px-3 rounded-xl shadow-xs">
              <button
                type="button"
                onClick={() => handleToggleNotification(!notificationEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                  notificationEnabled ? 'bg-rose-500' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notificationEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`text-[10px] sm:text-xs font-black w-14 text-center ${notificationEnabled ? 'text-rose-600' : 'text-slate-400'}`}>
                {notificationEnabled ? '가동중' : '중단됨'}
              </span>
            </div>
          </div>
        </div>

        {/* Input Interface Wrapper: Two options (Text / Image) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch mb-8">
          
          {/* Hidden Canvas for Camera Frame Capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* File Upload Stage */}
          <div className="lg:col-span-5 flex flex-col">
            <div 
              onDragOver={isCameraActive ? undefined : handleDragOver}
              onDragLeave={isCameraActive ? undefined : handleDragLeave}
              onDrop={isCameraActive ? undefined : handleDrop}
              className={`flex-1 min-h-[220px] rounded-3xl p-5 border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isCameraActive
                  ? 'border-emerald-400 bg-slate-950/5'
                  : isDragging 
                  ? 'border-teal-500 bg-teal-50/40 scale-[0.99] shadow-inner' 
                  : imagePreview 
                  ? 'border-teal-400 bg-teal-50/10' 
                  : 'border-slate-300 hover:border-teal-400 hover:bg-slate-50/50 bg-white'
              }`}
              onClick={() => {
                if (!isCameraActive && !imagePreview) {
                  fileInputRef.current?.click();
                }
              }}
            >
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileInput}
                accept="image/*"
                className="hidden"
              />

              {isCameraActive ? (
                <div 
                  className="relative w-full h-[220px] rounded-2xl overflow-hidden bg-black flex flex-col items-center justify-center border border-slate-800"
                  onClick={(e) => e.stopPropagation()} // Prevent trigger upload
                >
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className={`w-full h-full object-cover rounded-2xl ${cameraFacingMode === 'user' ? 'transform scale-x-[-1]' : ''}`}
                  />
                  {/* Subtle target crosshair or scanline in the center */}
                  <div className="absolute inset-0 border-[2px] border-emerald-500/35 rounded-2xl m-6 pointer-events-none flex items-center justify-center">
                    <div className="w-6 h-0.5 bg-emerald-400 absolute"></div>
                    <div className="h-6 w-0.5 bg-emerald-400 absolute"></div>
                    <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse shadow-xs"></div>
                  </div>

                  {/* UI controls overlaid on bottom */}
                  <div className="absolute bottom-2 inset-x-2 flex items-center justify-between gap-1.5 bg-slate-950/80 backdrop-blur-xs p-1.5 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Toggle camera direction (user vs environment)
                        const nextMode = cameraFacingMode === 'user' ? 'environment' : 'user';
                        setCameraFacingMode(nextMode);
                        startCamera(nextMode);
                      }}
                      className="cursor-pointer p-1.5 sm:p-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg text-[10px] sm:text-xs font-bold transition-colors flex items-center gap-1"
                      title="전면/후면 전환"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="hidden sm:inline">화면 전환</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        captureSelfieAndAnalyze();
                      }}
                      className="cursor-pointer px-3 sm:px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] sm:text-sm rounded-lg shadow-sm flex items-center gap-1.5 animate-pulse transition-all active:scale-95"
                    >
                      <Camera className="w-4 h-4 text-emerald-100" />
                      촬영하기
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        stopCamera();
                      }}
                      className="cursor-pointer px-2 py-1.5 bg-slate-800 hover:bg-rose-600 text-slate-100 rounded-lg text-[10px] sm:text-xs font-bold transition-colors"
                    >
                      끄기
                    </button>
                  </div>
                  
                  {cameraError && (
                    <div className="absolute inset-x-0 bottom-0 top-0 bg-slate-900/95 flex flex-col items-center justify-center p-4 text-center z-10 animate-in fade-in duration-300">
                      <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
                      <p className="text-white text-xs font-bold leading-normal mb-3">{cameraError}</p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          stopCamera();
                        }}
                        className="cursor-pointer px-3 py-1.5 bg-slate-800 text-white font-bold text-xs rounded-lg hover:bg-slate-700"
                      >
                        돌아가기
                      </button>
                    </div>
                  )}
                </div>
              ) : imagePreview ? (
                <div className="relative w-full h-full min-h-[180px] flex flex-col justify-between items-center group">
                  <div className="absolute top-0 right-0 z-10 flex gap-1.5 p-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Open the cropping modal
                        setIsCropModalOpen(true);
                      }}
                      className="p-1 px-2.5 text-xs text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 transition-colors rounded-full flex items-center gap-1 shadow-md font-semibold cursor-pointer align-middle"
                      title="원재료 가이드 표시 및 세부 영역 자르기"
                    >
                      <Crop className="w-3.5 h-3.5" /> 자르기 (Crop)
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearImage();
                      }}
                      className="p-1 px-2.5 text-xs text-white bg-slate-900/70 hover:bg-red-650 transition-colors rounded-full flex items-center gap-1 shadow-md font-semibold cursor-pointer align-middle"
                    >
                      <X className="w-3.5 h-3.5" /> 삭제
                    </button>
                  </div>
                  <div className="flex-1 flex items-center justify-center p-3 mt-4">
                    <img 
                      src={imagePreview} 
                      alt="포장지 원재료" 
                      className="max-h-[140px] max-w-full rounded-2xl object-contain shadow-md border border-slate-200/50"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-[10px] sm:text-xs font-semibold text-teal-700 bg-teal-50/80 border border-teal-150 px-3 py-1.5 rounded-full">
                    <ImageIcon className="w-3.5 h-3.5" /> 원재료 사진 가공 완료
                    <span className="text-[9px] text-teal-600 bg-teal-100/60 px-1.5 py-0.5 rounded-md font-bold">크롭 가능</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="p-4 bg-teal-50/80 rounded-2xl border border-teal-100 text-teal-600 mb-3 shadow-sm hover:scale-105 transition-transform duration-300">
                    <Upload className="w-6 h-6 animate-bounce" />
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-slate-700">원재료명 사진 업로드 / 드롭</span>
                  <p className="text-slate-450 text-[10px] sm:text-xs mt-1 leading-relaxed max-w-[185px] mb-3">
                    가공식품 원재료 표시 부위 혹은 메뉴판 사진을 업로드해 주세요.
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      startCamera();
                    }}
                    className="cursor-pointer bg-teal-600 hover:bg-teal-700 text-white font-black text-[10px] sm:text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm hover:shadow-md transition-all active:scale-95"
                  >
                    <Camera className="w-3.5 h-3.5 fill-teal-100/20" /> 실시간 카메라 가동
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Text Input Stage */}
          <div className="lg:col-span-7 flex flex-col">
            <div className="flex-1 bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <Utensils className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">직접 입력 (또는 사진 추가 메모)</span>
              </div>
              <textarea
                placeholder="음식 이름이나 가공식품 원재료 내용을 직접 작성하실 수 있습니다.&#10;예) 점심으로 조기 사다가 매운탕 해먹을 건데, 무랑 파 넣고 국 간장 살짝 넣었어."
                className="flex-1 w-full min-h-[120px] bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-700 placeholder:text-slate-400 text-sm outline-none resize-none transition-all focus:border-teal-300 focus:bg-white"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <div className="flex items-center justify-between mt-4">
                <div className="text-xs text-slate-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>사진과 함께 상세 질문을 추가하면 분석률이 더욱 올라갑니다.</span>
                </div>
                <button
                  id="analyze-button"
                  onClick={handleAnalyze}
                  disabled={loading || (!input.trim() && !imageBase64)}
                  className="px-6 py-3 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold tracking-tight transition-all shadow-md shadow-teal-600/10 flex items-center gap-2 flex-shrink-0"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      성분 밀착 분석 중...
                    </>
                  ) : (
                    <>분석 시작하기</>
                  )}
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Diagnostic Guide Rules banner */}
        <div className="bg-gradient-to-r from-teal-600 to-emerald-700 text-white rounded-3xl p-5 md:p-6 shadow-md mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-2xl flex-shrink-0">
              <Calendar className="w-6 h-6 text-teal-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-teal-50 text-sm md:text-base">어류 / 해산물 / 소고기 핵심 규칙</h3>
              </div>
              <p className="text-teal-100/90 text-xs md:text-sm mt-0.5 max-w-2xl leading-relaxed">
                바다 해산물 중 오직 <strong>연어, 숭어, 농어</strong> 딱 3가지만 허용됩니다. 그 외 게, 조개, 오징어 등 바다 생물은 강력 금지됩니다. 또한 <strong>소고기는 치료 시작 후 3개월(90일) 이후만 허용</strong>됩니다!
              </p>
            </div>
          </div>
        </div>

        {/* Diagnostic Results Loading State / Error State */}
        {error && (
          <div className="bg-red-50 text-red-700 p-6 rounded-3xl mb-8 flex gap-4 items-start border border-red-100">
            <AlertCircle className="w-6 h-6 flex-shrink-0 text-red-500 mt-0.5" />
            <div>
              <h4 className="font-semibold mb-1">분석 에러</h4>
              <p className="leading-relaxed text-sm">{error}</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="bg-white rounded-3xl p-12 shadow-sm border border-slate-200/50 flex flex-col items-center justify-center space-y-4 mb-8">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-slate-100 border-t-teal-600 animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-teal-600">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
            </div>
            <div className="text-center">
              <p className="font-semibold text-slate-800">성분 스캔 & OCR 실행 중...</p>
              <p className="text-xs text-slate-400 mt-1">밀, 대두, 콩기름, 바다 해산물, MSG 등 숨겨진 성분까지 완벽하게 추출하여 분석합니다.</p>
            </div>
          </div>
        )}

        {/* Diagnostic Results Presentation */}
        {result && !loading && (
          <div 
            id="result-box" 
            className="bg-white rounded-3xl p-6 md:p-8 shadow-md border border-slate-200/60 animate-in fade-in slide-in-from-bottom-3 duration-500 mb-8"
          >
            <div className="flex items-center gap-2.5 mb-6 pb-4 border-b border-slate-100">
              <BookOpen className="w-5 h-5 text-teal-600" />
              <h2 className="font-bold text-slate-800 text-lg">생태 유전체 맞춤 성분 분석 리포트</h2>
            </div>
            
            <div className="markdown-body prose prose-slate prose-teal max-w-none 
              prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-slate-800
              prose-p:leading-relaxed prose-li:my-1 prose-ul:list-disc
              prose-strong:font-bold prose-strong:text-slate-900 mb-8"
            >
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>

            {/* Quick Saver inside Result Card */}
            <div className="mt-8 pt-6 border-t border-slate-100 bg-slate-50/50 p-5 rounded-2xl border border-slate-200/50">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-teal-600" />
                <h3 className="font-bold text-slate-800 text-sm">📅 이 분석 결과를 맞춤 식단 일지에 직접 등록</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">선택 날짜</label>
                  <input 
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-teal-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">식사 구분</label>
                  <div className="grid grid-cols-4 gap-1">
                    {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((type) => {
                      const typeLabel = type === 'breakfast' ? '🌄 아침' : type === 'lunch' ? '☀️ 점심' : type === 'dinner' ? '🌙 저녁' : '🍉 간식';
                      return (
                        <button
                          key={type}
                          onClick={() => setFormMealType(type)}
                          type="button"
                          className={`py-2 text-[10px] font-bold rounded-lg transition-all border ${
                            formMealType === type 
                              ? 'bg-teal-600 border-teal-600 text-white shadow-sm' 
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {typeLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">식단 수정명 (선택사항)</label>
                  <input 
                    type="text"
                    placeholder="예) 현미밥, 숭어구이, 당근 샐러드"
                    value={formMealName}
                    onChange={(e) => setFormMealName(e.target.value)}
                    className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs text-slate-700 outline-none focus:border-teal-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">통증 및 관절 상태 수치</label>
                  <div className="flex items-center gap-1.5 mt-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setFormPainLevel(level)}
                        className="p-1 text-slate-400 hover:scale-110 transition-transform"
                      >
                        <Heart 
                          className={`w-5 h-5 transition-colors ${
                            formPainLevel >= level ? 'text-red-500 fill-red-500' : 'text-slate-300'
                          }`} 
                        />
                      </button>
                    ))}
                    <span className="text-[11px] font-bold text-slate-500 ml-2">
                      {formPainLevel === 1 ? '아치 통증 전혀없음 🍏' : formPainLevel === 3 ? '약간 욱신 💡' : formPainLevel === 5 ? '통증 심함 ⚠️' : `통증레벨 ${formPainLevel}`}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">EBM 보조 요법</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['none', 'juice', 'powder'] as const).map((juice) => {
                      const label = juice === 'juice' ? '🥤 녹즙 복용' : juice === 'powder' ? '🍵 녹즙가루' : '❌ 미복용';
                      return (
                        <button
                          key={juice}
                          type="button"
                          onClick={() => setFormGreenJuice(juice)}
                          className={`py-2 text-[10px] font-bold rounded-lg border transition-all ${
                            formGreenJuice === juice
                              ? 'bg-teal-600 border-teal-600 text-white'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">처방 약물 / EBM 맞춤 제품 복용</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFormMedication('taken')}
                      className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                        formMedication === 'taken'
                          ? 'bg-teal-600 border-teal-600 text-white'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      💊 복용 완료
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormMedication('none')}
                      className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                        formMedication === 'none'
                          ? 'bg-teal-600 border-teal-600 text-white'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      ❌ 미복용
                    </button>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">수기 추가 기록 및 감사한 일 (선택)</label>
                  <input
                    type="text"
                    placeholder="예) 오늘 아침 통증이 아주 경미해서 너무 가뿐하다. 소금간으로만 담백하고 유익한 한끼!"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs text-slate-700 outline-none focus:border-teal-400 transition-colors"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t border-slate-200/50">
                <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5" /> 분석된 진단 판정은 일지 기록 시 자동으로 등급(안전/주의/불가)이 연동 기입됩니다.
                </span>
                <button
                  onClick={handleSaveAnalysisToDiary}
                  className="w-full sm:w-auto px-5 py-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1"
                >
                  <Plus className="w-4 h-4" /> EBM 식단 일지에 안전하게 등록
                </button>
              </div>
            </div>

          </div>
        )}

        {/* ======================================================= */}
        {/* EBM CUSTOM WEEKLY & MONTHLY CALENDAR & DIARY MANAGER    */}
        {/* ======================================================= */}
        <div 
          id="calendar-section" 
          className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-4 sm:p-6 mb-8 transition-all relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-2 h-full bg-teal-500"></div>
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-50 text-teal-600 rounded-xl">
                <Calendar className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <span className="text-[9px] bg-teal-50 text-teal-700 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">안심 일지</span>
                <h3 className="font-extrabold text-slate-800 text-xs sm:text-sm md:text-base leading-tight">
                  보영 안심 식단 캘린더 & 맞춤 일기 대시보드
                </h3>
              </div>
            </div>
            
            {/* View Switching tabs */}
            <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setCalendarView('weekly')}
                className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  calendarView === 'weekly' 
                    ? 'bg-white text-teal-700 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                주간 뷰
              </button>
              <button
                onClick={() => setCalendarView('monthly')}
                className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  calendarView === 'monthly' 
                    ? 'bg-white text-teal-700 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                월간 달력 뷰
              </button>
              <button
                onClick={() => setCalendarView('gallery')}
                className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                  calendarView === 'gallery' 
                    ? 'bg-white text-teal-700 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>📸</span>
                <span>식단 갤러리</span>
              </button>
            </div>
          </div>

          {/* Toast Alert */}
          {successToast && (
            <div className="mb-4 bg-teal-50 border border-teal-100 text-teal-800 px-4 py-3 rounded-2xl flex items-center justify-between gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-1 duration-200">
              <span className="flex items-center gap-1.5">
                <span className="flex-shrink-0 w-2 h-2 rounded-full bg-teal-500 animate-ping"></span>
                {successToast}
              </span>
              <button onClick={() => setSuccessToast(null)} className="text-teal-400 hover:text-teal-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 주간 건강 상태 요약 카드 (Weekly Pain & Forbidden Food Summary Card) */}
          {(() => {
            const weekDays = getWeekDays(selectedDate);
            const weekDateStrings = weekDays.map(d => formatDateStr(d));
            const currentWeekRecords = savedRecords.filter(r => weekDateStrings.includes(r.date));
            
            // 1. 평균 통증 수치 계산
            const painRecords = currentWeekRecords.filter(r => r.painLevel !== undefined);
            const avgPain = painRecords.length > 0 
              ? Number((painRecords.reduce((sum, r) => sum + (r.painLevel || 1), 0) / painRecords.length).toFixed(1))
              : null;
              
            // 2. 금기 식품 섭취 횟수 계산
            const forbiddenMeals = currentWeekRecords.filter(r => r.rating === 'forbidden');
            const forbiddenCount = forbiddenMeals.length;

            return (
              <div className="mb-6 bg-gradient-to-br from-slate-50 to-slate-100/40 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 shadow-xs">
                <div className="flex items-center gap-2 mb-3 border-b border-slate-200/50 pb-2">
                  <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-teal-500 text-white">
                    EBM 분석 Report
                  </span>
                  <h4 className="text-[11px] sm:text-xs md:text-sm font-black text-slate-700">이번 주 안심 및 통증 상관관계 요약</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 평균 통증 수치 카드 */}
                  <div className="bg-white rounded-xl border border-slate-200/40 p-3.5 flex items-start gap-3">
                    <div className="p-2 bg-rose-50 text-rose-500 rounded-xl">
                      <Heart className="w-5 h-5 fill-rose-100" />
                    </div>
                    <div className="flex-1">
                      <span className="text-[10px] font-bold text-slate-400 block">주간 평균 관절 통증 수치</span>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-lg md:text-xl font-black text-slate-800">
                          {avgPain !== null ? `${avgPain}` : '기록 없음'}
                        </span>
                        {avgPain !== null && (
                          <span className="text-[10px] font-bold text-slate-400">/ 5.0</span>
                        )}
                      </div>
                      
                      <div className="mt-2">
                        {avgPain === null ? (
                          <span className="text-[10px] font-semibold text-slate-400 leading-none">식단 일지 등록 시 통증 수치를 기입해주세요.</span>
                        ) : avgPain <= 1.5 ? (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-md inline-block">
                            🍏 안심 (매우 안정적인 관절 상태)
                          </span>
                        ) : avgPain <= 3.0 ? (
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-md inline-block">
                            💡 주의 (관절 보호 및 가벼운 통증 조절 필요)
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-md inline-block">
                            ⚠️ 위험 (염증 신호 활성화 우려, 면밀한 식단 관리)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 금기 식품 노출 빈도 카드 */}
                  <div className="bg-white rounded-xl border border-slate-200/40 p-3.5 flex items-start gap-3">
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <span className="text-[10px] font-bold text-slate-400 block">주간 금기식품 노출 빈도</span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className={`text-lg md:text-xl font-black ${forbiddenCount > 0 ? 'text-rose-600 animate-pulse' : 'text-emerald-600'}`}>
                          {forbiddenCount}회
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 ml-1">의 제한식품 유입</span>
                      </div>

                      <div className="mt-2">
                        {forbiddenCount === 0 ? (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-md inline-block">
                            🏆 완벽! 해독과 관절 정화가 대단히 원활합니다.
                          </span>
                        ) : (
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-md inline-block">
                              ⚠️ 미세 유입 검출! 원재료와 양념류를 재점검하세요.
                            </span>
                            <div className="text-[9px] text-slate-400 leading-tight">
                              유입된 식단: <span className="font-extrabold text-slate-600">{forbiddenMeals.map(m => m.mealName).slice(0, 3).join(', ')}</span>
                              {forbiddenMeals.length > 3 ? ' 등' : ''}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}





          {/* Navigation & Stats row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            {/* Date Select Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const curr = new Date(selectedDate);
                  if (calendarView === 'weekly') {
                    curr.setDate(curr.getDate() - 7);
                  } else {
                    curr.setMonth(curr.getMonth() - 1);
                  }
                  setSelectedDate(formatDateStr(curr));
                }}
                className="p-1.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all cursor-pointer"
                title={calendarView === 'weekly' ? '이전 주' : '이전 달'}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <span className="text-sm font-bold text-slate-800">
                {(() => {
                  const dObj = new Date(selectedDate);
                  return `${dObj.getFullYear()}년 ${dObj.getMonth() + 1}월`;
                })()}
              </span>

              <button
                onClick={() => {
                  const curr = new Date(selectedDate);
                  if (calendarView === 'weekly') {
                    curr.setDate(curr.getDate() + 7);
                  } else {
                    curr.setMonth(curr.getMonth() + 1);
                  }
                  setSelectedDate(formatDateStr(curr));
                }}
                className="p-1.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all cursor-pointer"
                title={calendarView === 'weekly' ? '다음 주' : '다음 달'}
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setSelectedDate('2026-06-14')}
                className="ml-2 text-[10px] sm:text-xs text-teal-600 border border-teal-100 hover:bg-teal-50 font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
              >
                오늘로 가기
              </button>
            </div>

            {/* Core Stats overview matching EBM logic */}
            {(() => {
              const weekDays = getWeekDays(selectedDate);
              const weekDateStrings = weekDays.map(d => formatDateStr(d));
              const currentWeekRecords = savedRecords.filter(r => weekDateStrings.includes(r.date));
              const safeCount = currentWeekRecords.filter(r => r.rating === 'safe').length;
              const forbiddenCount = currentWeekRecords.filter(r => r.rating === 'forbidden').length;
              
              let weekHealthScore = 100;
              if (currentWeekRecords.length > 0) {
                weekHealthScore = Math.round(((currentWeekRecords.length - forbiddenCount) / currentWeekRecords.length) * 100);
              }

              return (
                <div className="flex gap-2 sm:gap-4 text-xs font-bold w-full sm:w-auto">
                  <div className="bg-slate-50 border border-slate-100 p-2 rounded-xl text-center flex-1 min-w-[65px]">
                    <span className="block text-[8px] text-slate-400 font-bold uppercase">안심 식사</span>
                    <span className="text-sm text-emerald-600 font-extrabold">{safeCount}회</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 p-2 rounded-xl text-center flex-1 min-w-[65px]">
                    <span className="block text-[8px] text-slate-400 font-bold uppercase">금기 경고</span>
                    <span className="text-sm text-rose-600 font-extrabold">{forbiddenCount}회</span>
                  </div>
                  <div className="bg-teal-50/50 border border-teal-100/30 p-2 rounded-xl text-center flex-1 min-w-[90px]">
                    <span className="block text-[8px] text-teal-600 font-bold uppercase">식습관 안전 지수</span>
                    <span className="text-sm text-teal-700 font-extrabold">{weekHealthScore}점</span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* 1. WEEKLY ROW VIEW */}
          {calendarView === 'weekly' && (
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-6">
              {getWeekDays(selectedDate).map((dayDateObj) => {
                const dayDateStr = formatDateStr(dayDateObj);
                const isSelected = dayDateStr === selectedDate;
                const isToday = dayDateStr === '2026-06-14';
                const dayLabel = getDayLabel(dayDateObj.getDay());
                
                // Find all meals on this date
                const dayMeals = savedRecords.filter(r => r.date === dayDateStr);
                
                return (
                  <button
                    key={dayDateStr}
                    type="button"
                    onClick={() => setSelectedDate(dayDateStr)}
                    className={`p-2 sm:p-3 rounded-2xl flex flex-col items-center justify-between transition-all border outline-none h-24 sm:h-28 relative cursor-pointer ${
                      isSelected 
                        ? 'bg-teal-600 border-teal-600 text-white shadow-md scale-[1.02]' 
                        : isToday
                        ? 'bg-teal-50/50 border-teal-200 text-slate-800'
                        : 'bg-slate-50/30 border-slate-200/60 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <span className={`text-[10px] font-bold ${isSelected ? 'text-teal-100' : 'text-slate-400'}`}>
                      {dayLabel}
                    </span>
                    
                    <span className="text-sm sm:text-base font-black tracking-tight my-1">
                      {dayDateObj.getDate()}
                    </span>

                    {/* Meal micro-pills inside cell */}
                    <div className="flex justify-center gap-1 w-full flex-wrap h-4 content-center overflow-hidden">
                      {dayMeals.length === 0 ? (
                        <span className={`text-[9px] ${isSelected ? 'text-teal-200' : 'text-slate-300'} font-medium`}>-</span>
                      ) : (
                        dayMeals.map((meal, mIdx) => {
                          const ratingColor = meal.rating === 'safe' 
                            ? 'bg-emerald-400' 
                            : meal.rating === 'forbidden' 
                            ? 'bg-rose-500' 
                            : 'bg-amber-400';
                          return (
                            <span 
                              key={`${meal.id}-${mIdx}`}
                              className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${ratingColor}`}
                              title={`${meal.mealName} (${meal.rating})`}
                            />
                          );
                        })
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* 2. MONTHLY GRID VIEW */}
          {calendarView === 'monthly' && (
            <div className="mb-6">
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                <span className="text-red-500">일</span>
                <span>월</span>
                <span>화</span>
                <span>수</span>
                <span>목</span>
                <span>금</span>
                <span className="text-blue-500">토</span>
              </div>

              {/* Grid cell layout */}
              <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                {getMonthDaysGrid(new Date(selectedDate).getFullYear(), new Date(selectedDate).getMonth()).map((dayDateObj, idx) => {
                  if (!dayDateObj) {
                    return <div key={`empty-${idx}`} className="bg-slate-100/10 rounded-xl min-h-[50px] opacity-20"></div>;
                  }

                  const dayDateStr = formatDateStr(dayDateObj);
                  const isSelected = dayDateStr === selectedDate;
                  const isToday = dayDateStr === '2026-06-14';
                  const dayMeals = savedRecords.filter(r => r.date === dayDateStr);
                  
                  return (
                    <button
                      key={dayDateStr}
                      type="button"
                      onClick={() => setSelectedDate(dayDateStr)}
                      className={`p-1.5 sm:p-2 rounded-xl border flex flex-col items-start justify-between min-h-[50px] sm:min-h-[56px] transition-all hover:bg-slate-50 cursor-pointer ${
                        isSelected 
                          ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-100 text-teal-900 font-bold' 
                          : isToday
                          ? 'bg-teal-50/20 border-teal-200 text-slate-800'
                          : 'bg-white border-slate-100 text-slate-700'
                      }`}
                    >
                      <span className="text-xs font-bold self-start">{dayDateObj.getDate()}</span>
                      
                      {/* Dots & Meal summary counts */}
                      <div className="flex gap-0.5 sm:gap-1 flex-wrap mt-1 overflow-hidden max-h-[16px]">
                        {dayMeals.map((meal) => {
                          const dotColor = meal.rating === 'safe' 
                            ? 'bg-emerald-500' 
                            : meal.rating === 'forbidden' 
                            ? 'bg-rose-500' 
                            : 'bg-amber-400';
                          return (
                            <span 
                              key={meal.id} 
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: meal.rating === 'safe' ? '#10b981' : meal.rating === 'forbidden' ? '#ef4444' : '#f59e0b' }}
                              title={meal.mealName}
                            />
                          );
                        })}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. MEAL GALLERY DETAILED CHRONOLOGICAL VIEW */}
          {calendarView === 'gallery' && (
            <div className="mb-6 animate-in fade-in duration-500">
              {/* Gallery Filter & Search Header */}
              <div className="bg-slate-50/75 border border-slate-200/60 p-4 rounded-2xl mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  {/* Search Input */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="🔍 식사명 또는 재료 검색..."
                      value={gallerySearchQuery}
                      onChange={(e) => setGallerySearchQuery(e.target.value)}
                      className="w-full bg-white border border-slate-200 px-3 py-2 pl-9 rounded-xl text-xs text-slate-700 outline-none focus:border-teal-400 transition-colors font-semibold"
                    />
                    <div className="absolute left-3 top-2.5 text-slate-400 pointer-events-none">
                    </div>
                  </div>

                  {/* Rating Category Selector */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase mr-1 flex-shrink-0">EBM 판정:</span>
                    {(['all', 'safe', 'warning', 'forbidden'] as const).map((rFilter) => {
                      const isActive = galleryRatingFilter === rFilter;
                      let label = '전체';
                      let activeStyle = 'bg-teal-650 border-teal-650 text-white';
                      if (rFilter === 'safe') { label = '🍏 안전'; activeStyle = 'bg-emerald-600 border-emerald-600 text-white'; }
                      if (rFilter === 'warning') { label = '💡 주의'; activeStyle = 'bg-amber-500 border-amber-500 text-white'; }
                      if (rFilter === 'forbidden') { label = '⚠️ 금기'; activeStyle = 'bg-rose-600 border-rose-600 text-white'; }

                      return (
                        <button
                          key={rFilter}
                          onClick={() => setGalleryRatingFilter(rFilter)}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer flex-shrink-0 ${
                            isActive 
                              ? activeStyle 
                              : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Meal Type Selector */}
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase mr-1 flex-shrink-0">식사 구분:</span>
                    {(['all', 'breakfast', 'lunch', 'dinner', 'snack'] as const).map((mFilter) => {
                      const isActive = galleryMealFilter === mFilter;
                      let label = '전체';
                      if (mFilter === 'breakfast') label = '🌄 아침';
                      if (mFilter === 'lunch') label = '☀️ 점심';
                      if (mFilter === 'dinner') label = '🌙 저녁';
                      if (mFilter === 'snack') label = '🍉 간식';

                      return (
                        <button
                          key={mFilter}
                          onClick={() => setGalleryMealFilter(mFilter)}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer flex-shrink-0 ${
                            isActive 
                              ? 'bg-slate-800 border-slate-800 text-white' 
                              : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Gallery Grid */}
              {(() => {
                const filtered = savedRecords.filter(r => {
                  const matchesSearch = gallerySearchQuery === '' || 
                    r.mealName.toLowerCase().includes(gallerySearchQuery.toLowerCase()) ||
                    r.ingredients.toLowerCase().includes(gallerySearchQuery.toLowerCase()) ||
                    (r.notes && r.notes.toLowerCase().includes(gallerySearchQuery.toLowerCase()));
                  
                  const matchesRating = galleryRatingFilter === 'all' || r.rating === galleryRatingFilter;
                  const matchesMeal = galleryMealFilter === 'all' || r.mealType === galleryMealFilter;
                  
                  return matchesSearch && matchesRating && matchesMeal;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-16 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-slate-400">
                      <Camera className="w-8 h-8 text-slate-300 mx-auto mb-2.5 animate-bounce" />
                      <p className="font-extrabold text-slate-600 text-xs sm:text-sm">해당 필터에 부합하는 식단 일지 사진이 없습니다.</p>
                      <p className="text-[10px] text-slate-450 mt-1">상단 분석기에서 실시간 촬영 또는 업로드 후 [일지에 등록]을 가동해 보세요!</p>
                      {gallerySearchQuery || galleryRatingFilter !== 'all' || galleryMealFilter !== 'all' ? (
                        <button
                          onClick={() => {
                            setGallerySearchQuery('');
                            setGalleryRatingFilter('all');
                            setGalleryMealFilter('all');
                          }}
                          className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-black rounded-xl cursor-pointer"
                        >
                          필터 모두 초기화
                        </button>
                      ) : null}
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                    {filtered.map((record) => {
                      const mealLabel = record.mealType === 'breakfast' ? '🌄 아침' : record.mealType === 'lunch' ? '☀️ 점심' : record.mealType === 'dinner' ? '🌙 저녁' : '🍉 간식';
                      
                      let ratingBadge = '';
                      let ratingText = '';
                      
                      if (record.rating === 'safe') {
                        ratingBadge = 'bg-emerald-500/90 text-white border-emerald-400';
                        ratingText = '🍏 안전';
                      } else if (record.rating === 'forbidden') {
                        ratingBadge = 'bg-rose-600/90 text-white border-rose-500';
                        ratingText = '⚠️ 금기';
                      } else {
                        ratingBadge = 'bg-amber-500/90 text-white border-amber-400';
                        ratingText = '💡 주의';
                      }

                      return (
                        <div
                          key={record.id}
                          onClick={() => setActiveGalleryModalRecord(record)}
                          className="group bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md overflow-hidden flex flex-col justify-between transition-all duration-300 transform hover:-translate-y-1 cursor-pointer"
                        >
                          {/* Image Thumbnail Container */}
                          <div className="relative w-full h-44 bg-slate-950/5 overflow-hidden border-b border-slate-100">
                            {record.image ? (
                              <img
                                src={record.image}
                                alt={record.mealName}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-tr from-teal-50/50 to-teal-100/10 flex flex-col items-center justify-center text-center p-4">
                                <Sparkles className="w-7 h-7 text-teal-600/40 mb-1.5 animate-pulse" />
                                <span className="text-[10px] text-teal-700/60 font-black">EBM 안심 식습관</span>
                                <span className="text-[9px] text-slate-450 font-semibold">{record.mealName}</span>
                              </div>
                            )}

                            {/* Overlay Safety Indicator and Meal Type */}
                            <div className="absolute top-2.5 left-2.5 flex items-center gap-1">
                              <span className="text-[10px] font-black tracking-wider text-white bg-slate-950/75 px-2 py-0.5 rounded-lg border border-slate-800/10">
                                {mealLabel}
                              </span>
                            </div>

                            <div className="absolute top-2.5 right-2.5">
                              <span className={`text-[10px] font-black tracking-wider px-2 py-0.5 rounded-full border shadow-sm ${ratingBadge}`}>
                                {ratingText} ({record.score}점)
                              </span>
                            </div>

                            {/* Time indicators floating on the thumbnail bottom banner */}
                            <div className="absolute bottom-2 inset-x-2 flex items-center justify-between text-[9px] font-mono font-bold bg-slate-950/55 text-emerald-100 px-2 py-1 rounded-md">
                              <span>📅 {record.date}</span>
                              <span className="text-white">🩹 관절상태: ⭐{record.painLevel || 1}</span>
                            </div>
                          </div>

                          {/* Card Summary Details */}
                          <div className="p-3.5 flex-1 flex flex-col justify-between">
                            <div>
                              <h5 className="font-extrabold text-slate-800 text-xs sm:text-sm line-clamp-1 mb-1" title={record.mealName}>
                                {record.mealName}
                              </h5>
                              <p className="text-[10px] text-slate-500 font-bold line-clamp-2 leading-snug h-7">
                                {record.ingredients}
                              </p>
                            </div>
                            
                            <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 mt-2.5 text-[9px] text-slate-400 font-bold">
                              <span>치료 {record.dayCount}일 차</span>
                              <span className="text-teal-600 group-hover:underline flex items-center gap-0.5 font-extrabold">
                                상세 보기 & 복사 →
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Bottom Split panel: selected date diary entries & statistics details */}
          {calendarView !== 'gallery' && (
            <>
              <div className="grid grid-cols-1 gap-6 items-start mt-4 pt-4 border-t border-slate-100">
            
            {/* Left side: selected date logs */}
            <div className="space-y-4">
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-ping"></span>
                  <h4 className="font-bold text-slate-800 text-xs sm:text-sm">
                    📅 {(() => {
                      const dObj = new Date(selectedDate);
                      return `${dObj.getFullYear()}년 ${dObj.getMonth() + 1}월 ${dObj.getDate()}일 (${getDayLabel(dObj.getDay())}요일)`;
                    })()}의 맞춤 식단 안심 일기
                  </h4>
                </div>

                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="px-3 py-1.5 bg-slate-850 hover:bg-slate-900 text-white text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                >
                  {showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>{showAddForm ? '추가창 닫기' : '이 날짜에 직접 일지 추가'}</span>
                </button>
              </div>

              {/* Collapsed manual save entry widget */}
              {showAddForm && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 animate-in fade-in slide-in-from-top-2 duration-300">
                  <h5 className="font-bold text-xs text-slate-750 mb-3 flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5 text-teal-600" /> EBM 생태식단 캘린더 간편 추가
                  </h5>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">식사명 입력 (필수)</label>
                      <input 
                        type="text"
                        placeholder="예) 현미밥, 숭어구이, 도라지나물"
                        value={formMealName}
                        onChange={(e) => setFormMealName(e.target.value)}
                        className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold text-slate-705 outline-none focus:border-teal-400 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">식사 구분</label>
                      <div className="grid grid-cols-4 gap-1">
                        {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((type) => {
                          const label = type === 'breakfast' ? '🌄 아침' : type === 'lunch' ? '☀️ 점심' : type === 'dinner' ? '🌙 저녁' : '🍉 간식';
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setFormMealType(type)}
                              className={`py-1.5 text-[10px] font-bold rounded border transition-all cursor-pointer ${
                                formMealType === type 
                                  ? 'bg-teal-600 border-teal-600 text-white' 
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">통증 수치</label>
                      <div className="flex items-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => setFormPainLevel(lvl)}
                            className="p-1 transition-transform hover:scale-110 cursor-pointer"
                          >
                            <Heart className={`w-5 h-5 ${formPainLevel >= lvl ? 'text-red-500 fill-red-500' : 'text-slate-300'}`} />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">녹즙 복용여부</label>
                      <div className="grid grid-cols-3 gap-1">
                        {(['none', 'juice', 'powder'] as const).map((jz) => (
                          <button
                            key={jz}
                            type="button"
                            onClick={() => setFormGreenJuice(jz)}
                            className={`py-1.5 text-[9px] font-bold rounded border transition-all cursor-pointer ${
                              formGreenJuice === jz ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-slate-200 text-slate-600'
                            }`}
                          >
                            {jz === 'juice' ? '🥤 녹즙' : jz === 'powder' ? '🍵 가루' : '❌ 미복용'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">처방약 / 맞춤제품</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setFormMedication('taken')}
                          className={`py-1.5 text-[10px] font-bold rounded border transition-all cursor-pointer ${
                            formMedication === 'taken' ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-slate-100 text-slate-600'
                          }`}
                        >
                          💊 복용 완료
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormMedication('none')}
                          className={`py-1.5 text-[10px] font-bold rounded border transition-all cursor-pointer ${
                            formMedication === 'none' ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-slate-100 text-slate-600'
                          }`}
                        >
                          ❌ 미복용
                        </button>
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">특징 기재 및 오늘의 감사한 일</label>
                      <input 
                        type="text"
                        placeholder="예) 통증 전혀 없음. 숭어 소금구이로 정말 담백하고 감사하게 식사 완료!"
                        value={formNotes}
                        onChange={(e) => setFormNotes(e.target.value)}
                        className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs text-slate-700 outline-none"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="px-3 py-1.5 text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleDirectManualSave}
                      className="px-4 py-1.5 text-xs font-bold text-white bg-teal-600 rounded-lg hover:bg-teal-700 active:bg-teal-800 cursor-pointer"
                    >
                      기록 등록하기
                    </button>
                  </div>
                </div>
              )}

              {/* List of saved records for selectedDate */}
              {(() => {
                const dateRecords = savedRecords.filter(r => r.date === selectedDate);
                if (dateRecords.length === 0) {
                  return (
                    <div className="text-center py-10 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                      <p className="font-bold mb-1.5">선택한 날짜의 안심 식단 일지가 아직 작성되지 않았습니다.</p>
                      <p className="text-[10px]">위의 식품 분석기에서 상세 분석 후 [일지에 등록] 하거나 [직접 일지 추가] 단추를 통해 손쉽게 작성해보세요!</p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dateRecords.map((record) => {
                      const isCopied = copiedRecordId === record.id;
                      
                      let ratingBadge = '';
                      let ratingText = '';
                      let cardBorder = '';
                      
                      if (record.rating === 'safe') {
                        ratingBadge = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                        ratingText = '🍏 안전';
                        cardBorder = 'border-emerald-100 hover:shadow-emerald-50/50';
                      } else if (record.rating === 'forbidden') {
                        ratingBadge = 'bg-rose-50 text-rose-700 border-rose-100';
                        ratingText = '⚠️ 섭취 불가';
                        cardBorder = 'border-rose-100 hover:shadow-rose-50/50';
                      } else {
                        ratingBadge = 'bg-amber-50 text-amber-700 border-amber-100';
                        ratingText = '💡 주의 필요';
                        cardBorder = 'border-amber-100 hover:shadow-amber-50/50';
                      }

                      const mealLabel = record.mealType === 'breakfast' ? '🌄 아침' : record.mealType === 'lunch' ? '☀️ 점심' : record.mealType === 'dinner' ? '🌙 저녁' : '🍉 간식';

                      return (
                        <div 
                          key={record.id}
                          className={`bg-white border rounded-2xl p-4 transition-all duration-300 hover:shadow-md flex flex-col justify-between ${cardBorder}`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                              <span className="text-[11px] font-bold text-slate-500 bg-slate-105 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                {mealLabel}
                              </span>
                              
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[10px] font-bold px-2 py-0.5 border rounded-full ${ratingBadge}`}>
                                  {ratingText} (안심도: {record.score}%)
                                </span>
                                <span className="text-[9px] text-slate-400 font-mono">치료 {record.dayCount}일차</span>
                              </div>
                            </div>

                            <h5 className="font-bold text-slate-800 text-sm mb-1.5">{record.mealName}</h5>
                            
                            {record.ingredients && (
                              <p className="text-[11px] text-slate-600 leading-snug mb-3 font-semibold bg-slate-50 p-2.5 rounded-xl">
                                <span className="text-slate-400 text-[10px] block mb-1">🌾 EBM 검출 재료:</span>
                                {record.ingredients}
                              </p>
                            )}

                            {/* Additional metadata row */}
                            <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 font-bold mb-3">
                              <span className="flex items-center gap-1 bg-slate-50/60 p-1.5 rounded-lg">
                                🥤 녹즙배정: <strong className="text-teal-700 ml-1">{record.greenJuice === 'juice' ? '녹즙' : record.greenJuice === 'powder' ? '녹즙가루' : '미복용'}</strong>
                              </span>
                              <span className="flex items-center gap-1 bg-slate-50/60 p-1.5 rounded-lg">
                                💊 처방약물: <strong className="text-teal-700 ml-1">{record.medication === 'taken' ? '복용' : '미복용'}</strong>
                              </span>
                            </div>

                            <div className="flex items-center gap-1 mb-3">
                              <span className="text-[10px] text-slate-400 font-bold mr-1">🩹 관절상태:</span>
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Heart 
                                  key={i} 
                                  className={`w-3.5 h-3.5 ${
                                    (record.painLevel || 1) > i ? 'text-red-500 fill-red-500' : 'text-slate-200'
                                  }`} 
                                />
                              ))}
                            </div>

                            {record.notes && (
                              <p className="text-[11px] text-slate-650 bg-teal-50/10 border border-teal-100/20 p-2.5 rounded-xl leading-relaxed italic mb-4">
                                " {record.notes} "
                              </p>
                            )}
                          </div>

                          {/* Action rows: Clipboard / Analysis reload / Delete */}
                          <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-2 gap-2 text-[11px]">
                            <button
                              onClick={() => handleCopyRecord(record)}
                              className={`flex-1 py-1.5 rounded-lg font-bold transition-all border flex items-center justify-center gap-1.5 cursor-pointer ${
                                isCopied 
                                  ? 'bg-emerald-600 border-emerald-600 text-white' 
                                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  공식양식 복사완료
                                </>
                              ) : (
                                <>
                                  <FileText className="w-3.5 h-3.5" />
                                  EBM 일지양식 복사
                                </>
                              )}
                            </button>

                            <button
                              onClick={() => handleLoadRecord(record)}
                              className="px-2.5 py-1.5 border border-slate-200 hover:border-teal-400 hover:text-teal-700 text-slate-500 font-bold rounded-lg transition-all cursor-pointer"
                              title="다시 상세 식품 분석에 올리기"
                            >
                              분석올리기
                            </button>

                            <button
                              onClick={() => handleDeleteRecord(record.id)}
                              className="p-1.5 border border-slate-200 hover:bg-rose-50 hover:border-rose-300 text-slate-450 hover:text-rose-600 rounded-lg transition-all cursor-pointer"
                              title="일지 기록 삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

            </div>

          </div>

          {/* Smart Trend Correlation Alert Banner (Drives correlation insight dynamically!) */}
          {(() => {
            // Find recent pain occurrences & correlate with forbidden foods
            const painRecords = savedRecords.filter(r => (r.painLevel || 1) >= 3);
            const forbiddenEaten = savedRecords.filter(r => r.rating === 'forbidden');
            
            if (painRecords.length > 0 && forbiddenEaten.length > 0) {
              const latestPain = painRecords[0];
              const latestForbidden = forbiddenEaten[0];
              
              return (
                <div className="mt-6 p-4 bg-red-50/50 border border-rose-250/20 rounded-2xl flex gap-3 text-xs text-rose-900 leading-relaxed items-start animate-in fade-in duration-300">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
                  <div>
                    <h5 className="font-extrabold text-rose-800 text-[13px] mb-0.5">📊 AI 통증 및 식단 상관관계 스마트 분석 리포트</h5>
                    <p className="text-rose-900/85">
                      보영님의 최근 기록을 추적한 결과 관절 통증 수치가 ⭐{latestPain.painLevel} 이상으로 상승하는 현상이 감지되었습니다. 
                      역추적 분석 결과, <strong>{latestForbidden.date}</strong>에 섭취하신 <strong>"{latestForbidden.mealName}"</strong> 내의 바다생 생선류 혹은 금기 조미료(간장, 된장, 들기름)의 미세 유입이 면역계 급성 염증 스파이크를 가속화한 주요 요인으로 추정됩니다.
                      류마티스 완화 주간을 완성하기 위해, 외식이나 양념 조리 시 오직 안전한 <strong>천일염, 참기름, 올리브유</strong>만을 고집하여 극밀 안심 조치를 전개하시길 적극 권장합니다.
                    </p>
                  </div>
                </div>
              );
            }
            return null;
          })()}
          </>
          )}

          {/* 4. GALLERY DETAIL FULLSCALE MODEL LIGHTBOX POPUP */}
          {activeGalleryModalRecord && (
            <div 
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-300"
              onClick={() => setActiveGalleryModalRecord(null)}
            >
              <div 
                className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header aspect */}
                <div className="relative h-48 sm:h-56 bg-slate-900 border-b border-slate-100">
                  {activeGalleryModalRecord.image ? (
                    <img
                      src={activeGalleryModalRecord.image}
                      alt={activeGalleryModalRecord.mealName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-teal-500/20 to-teal-600/5 flex flex-col items-center justify-center">
                      <Sparkles className="w-12 h-12 text-teal-600 mb-2 animate-pulse" />
                      <span className="text-xs text-teal-700/80 font-mono font-black">EBM 라이프 스타일 아카이브</span>
                    </div>
                  )}

                  {/* Top Close button overlay */}
                  <button
                    onClick={() => setActiveGalleryModalRecord(null)}
                    className="absolute top-3 right-3 p-2 bg-slate-950/70 text-white hover:bg-slate-900 rounded-full transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div className="absolute top-3 left-3 flex gap-2">
                    <span className="text-xs font-black tracking-wider text-white bg-slate-950/75 px-3 py-1 rounded-xl">
                      {activeGalleryModalRecord.mealType === 'breakfast' ? '🌄 아침' : activeGalleryModalRecord.mealType === 'lunch' ? '☀️ 점심' : activeGalleryModalRecord.mealType === 'dinner' ? '🌙 저녁' : '🍉 간식'}
                    </span>
                    <span className={`text-xs font-black tracking-wider px-3 py-1 rounded-xl shadow-sm border ${
                      activeGalleryModalRecord.rating === 'safe'
                        ? 'bg-emerald-600 border-emerald-500 text-white'
                        : activeGalleryModalRecord.rating === 'forbidden'
                        ? 'bg-rose-600 border-rose-500 text-white'
                        : 'bg-amber-500 border-amber-400 text-white'
                    }`}>
                      {activeGalleryModalRecord.rating === 'safe' ? '🍏 안전' : activeGalleryModalRecord.rating === 'forbidden' ? '⚠️ 섭취 불가' : '💡 주의'} ({activeGalleryModalRecord.score}%)
                    </span>
                  </div>

                  <div className="absolute bottom-3 inset-x-3 bg-slate-950/60 backdrop-blur-xs p-2 rounded-xl border border-slate-700/30 flex justify-between text-xs text-white font-mono font-bold">
                    <span>📅 식사일자: {activeGalleryModalRecord.date}</span>
                    <span>🩹 관절 통증 수치: ⭐{activeGalleryModalRecord.painLevel || 1}/5</span>
                  </div>
                </div>

                {/* Body details */}
                <div className="p-5 sm:p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                  <div>
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase">식사명</span>
                    <h4 className="text-lg font-black text-slate-800 leading-tight">
                      {activeGalleryModalRecord.mealName}
                    </h4>
                    <span className="text-[11px] text-teal-700 font-bold bg-teal-50 px-2.5 py-0.5 rounded-md inline-block mt-1">
                      치료 {activeGalleryModalRecord.dayCount}일 차 EBM 맞춤 분석일지
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/50">
                    <span className="text-[10px] text-slate-400 font-extrabold block mb-1">🌾 EBM 검출 및 매칭 완료 성분:</span>
                    <p className="text-xs text-slate-700 font-bold leading-normal">
                      {activeGalleryModalRecord.ingredients}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs font-bold">
                    <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 block mb-0.5">🥤 녹즙 배정</span>
                      <strong className="text-slate-800">
                        {activeGalleryModalRecord.greenJuice === 'juice' ? '녹즙 정밀 복용' : activeGalleryModalRecord.greenJuice === 'powder' ? '녹즙가루 대체' : '미복용'}
                      </strong>
                    </div>
                    <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 block mb-0.5">💊 병원 처방약</span>
                      <strong className="text-slate-800">
                        {activeGalleryModalRecord.medication === 'taken' ? '규정 지침 복용 완료' : '미복용 리포트'}
                      </strong>
                    </div>
                  </div>

                  {activeGalleryModalRecord.notes && (
                    <div className="bg-teal-50/15 border border-teal-100/30 p-3.5 rounded-2xl">
                      <span className="text-[10px] text-teal-600 font-extrabold block mb-1">📝 기록 수첩 / 통증 메모:</span>
                      <p className="text-xs text-slate-700 leading-relaxed italic">
                        "{activeGalleryModalRecord.notes}"
                      </p>
                    </div>
                  )}
                  
                  {/* Copy directly action inside lightbox modal */}
                  <div className="pt-3 border-t border-slate-100 flex gap-2">
                    <button
                      onClick={() => {
                        handleCopyRecord(activeGalleryModalRecord);
                      }}
                      className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl active:bg-teal-800 font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <FileText className="w-4 h-4 text-teal-100" />
                      EBM 공식양식 복사하기
                    </button>
                    
                    <button
                      onClick={() => {
                        handleLoadRecord(activeGalleryModalRecord);
                        setActiveGalleryModalRecord(null);
                        document.getElementById('analysis-section')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
                      title="이 분석을 바탕으로 상세 원재료 분석기 다시 로드"
                    >
                      분석 다시 가동
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 5. IMAGE COHESIVE CROPPING TOOL LIGHTBOX MODAL */}
          {isCropModalOpen && imagePreview && (
            <div 
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-300"
              onClick={() => setIsCropModalOpen(false)}
            >
              <div 
                className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <div className="flex items-center gap-2">
                    <Crop className="w-5 h-5 text-teal-655" />
                    <div>
                      <h4 className="font-black text-slate-800 text-sm sm:text-base">원재료 표시 영역 정밀 자르기</h4>
                      <p className="text-[10px] sm:text-xs text-slate-450 mt-0.5">불필요한 포장 문구를 걷어내어 성분 탐색 정확도를 높입니다.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsCropModalOpen(false)}
                    className="p-1.5 hover:bg-slate-200 rounded-full transition-colors cursor-pointer text-slate-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Cropper Workspace */}
                <div className="p-5 flex flex-col items-center justify-center bg-slate-900 border-b border-slate-100 relative">
                  <div className="relative overflow-hidden inline-block select-none max-w-full rounded-lg shadow-inner max-h-[320px]">
                    <img
                      src={imagePreview}
                      alt="Crop Source"
                      referrerPolicy="no-referrer"
                      className="max-h-[320px] max-w-full object-contain block opacity-100"
                    />

                    {/* Dark Mask overlays (renders outside the active crop frame) */}
                    <div className="absolute top-0 inset-x-0 bg-black/65 pointer-events-none" style={{ height: `${cropY}%` }} />
                    <div className="absolute bottom-0 inset-x-0 bg-black/65 pointer-events-none" style={{ height: `${100 - cropY - cropHeight}%` }} />
                    <div className="absolute left-0 bg-black/65 pointer-events-none" style={{ top: `${cropY}%`, bottom: `${100 - cropY - cropHeight}%`, width: `${cropX}%` }} />
                    <div className="absolute right-0 bg-black/65 pointer-events-none" style={{ top: `${cropY}%`, bottom: `${100 - cropY - cropHeight}%`, width: `${100 - cropX - cropWidth}%` }} />

                    {/* Active highlight crop box */}
                    <div 
                      className="absolute border-2 border-dashed border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.35)] flex items-center justify-center pointer-events-none"
                      style={{
                        top: `${cropY}%`,
                        left: `${cropX}%`,
                        width: `${cropWidth}%`,
                        height: `${cropHeight}%`
                      }}
                    >
                      {/* Active Indicator grid */}
                      <div className="w-full h-full relative">
                        <div className="absolute inset-0 border border-white/15"></div>
                        <div className="absolute left-1/3 inset-y-0 border-l border-dashed border-white/20"></div>
                        <div className="absolute right-1/3 inset-y-0 border-r border-dashed border-white/20"></div>
                        <div className="absolute top-1/3 inset-x-0 border-t border-dashed border-white/20"></div>
                        <div className="absolute bottom-1/3 inset-x-0 border-b border-dashed border-white/20"></div>
                        
                        {/* Corner markers/guides */}
                        <div className="absolute -top-1 -left-1 w-3.5 h-3.5 border-t-4 border-l-4 border-rose-500"></div>
                        <div className="absolute -top-1 -right-1 w-3.5 h-3.5 border-t-4 border-r-4 border-rose-500"></div>
                        <div className="absolute -bottom-1 -left-1 w-3.5 h-3.5 border-b-4 border-l-4 border-rose-500"></div>
                        <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 border-b-4 border-r-4 border-rose-500"></div>
                        
                        {/* Center Target Indicator */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 border border-dashed border-rose-400 rounded-full animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Control Panel */}
                <div className="p-5 space-y-4">
                  
                  {/* Aspect Presets Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/50">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase ml-1">형태 추천 사전 설정:</span>
                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          setCropX(20); setCropY(20); setCropWidth(60); setCropHeight(60);
                        }}
                        className="px-2.5 py-1 text-[10px] font-extrabold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        정사각형 (1:1)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCropX(10); setCropY(30); setCropWidth(80); setCropHeight(40);
                        }}
                        className="px-2.5 py-1 text-[10px] font-extrabold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        가로형 포장 (2:1)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCropX(30); setCropY(10); setCropWidth(40); setCropHeight(80);
                        }}
                        className="px-2.5 py-1 text-[10px] font-extrabold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        세로 성분표 (1:2)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCropX(0); setCropY(0); setCropWidth(100); setCropHeight(100);
                        }}
                        className="px-2.5 py-1 text-[10px] font-black text-rose-600 bg-rose-50 border border-rose-100 rounded-lg hover:bg-rose-100 transition-colors cursor-pointer"
                      >
                        🔓 전체 선택 (Reset)
                      </button>
                    </div>
                  </div>

                  {/* Sliders Block */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3.5 text-xs font-semibold text-slate-650">
                    {/* Left Axis */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-extrabold">
                        <span>좌측 시작점 (X Offset)</span>
                        <span className="text-teal-600 font-mono">{cropX}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={100 - cropWidth}
                        value={cropX}
                        onChange={(e) => setCropX(Number(e.target.value))}
                        className="w-full accent-teal-600 cursor-pointer h-1.5 bg-slate-150 rounded-lg appearance-none"
                      />
                    </div>

                    {/* Top Axis */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-extrabold">
                        <span>상단 시작점 (Y Offset)</span>
                        <span className="text-teal-600 font-mono">{cropY}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={100 - cropHeight}
                        value={cropY}
                        onChange={(e) => setCropY(Number(e.target.value))}
                        className="w-full accent-teal-650 cursor-pointer h-1.5 bg-slate-150 rounded-lg appearance-none"
                      />
                    </div>

                    {/* Box Width */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-extrabold">
                        <span>가로 너비 (Width)</span>
                        <span className="text-teal-600 font-mono">{cropWidth}%</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max={100 - cropX}
                        value={cropWidth}
                        onChange={(e) => setCropWidth(Number(e.target.value))}
                        className="w-full accent-teal-650 cursor-pointer h-1.5 bg-slate-150 rounded-lg appearance-none"
                      />
                    </div>

                    {/* Box Height */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-extrabold">
                        <span>세로 높이 (Height)</span>
                        <span className="text-teal-600 font-mono">{cropHeight}%</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max={100 - cropY}
                        value={cropHeight}
                        onChange={(e) => setCropHeight(Number(e.target.value))}
                        className="w-full accent-teal-650 cursor-pointer h-1.5 bg-slate-150 rounded-lg appearance-none"
                      />
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-normal text-center bg-slate-50 py-2 px-3 rounded-lg border border-slate-100">
                    💡 <strong>포장지 가이드:</strong> 인공지능 분석 시, 불필요한 제품 로고나 홍보 일러스트가 빠지고 
                    오직 <strong>[원재료명 및 함량] 글자 영역만</strong> 가득 들어가도록 구도를 잡아 주셔야 판정 오차가 최소화됩니다!
                  </p>

                  {/* Actions footer */}
                  <div className="flex gap-2.5 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setIsCropModalOpen(false)}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-extrabold text-xs rounded-xl cursor-pointer transition-colors"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={handleCropComplete}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10"
                    >
                      <Check className="w-4 h-4" /> 자르기 완료 (Crop)
                    </button>
                  </div>

                </div>
              </div>
            </div>
          )}

        </div>

        {/* Recent Analysis History Section */}
        {history.length > 0 && (
          <div className="bg-slate-50 rounded-3xl border border-slate-200/50 p-5 md:p-6 mb-8 animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2 text-slate-700">
                <History className="w-4 h-4 text-teal-600" />
                <h3 className="font-bold text-xs md:text-sm text-slate-800">최근 분석 히스토리 (최근 3개 저장)</h3>
              </div>
              <button 
                onClick={() => {
                  setHistory([]);
                  try {
                    localStorage.removeItem('ebm_analysis_history');
                  } catch (e) {
                    console.error(e);
                  }
                }}
                className="text-xs text-rose-500 hover:text-rose-700 font-bold transition-all px-2 py-1 rounded-lg hover:bg-rose-50"
              >
                전체 기록 삭제
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setResult(item.result);
                    setStartDate(getDaysAgoDateString(item.days));
                    if (item.input !== '포장지 및 성분 사진 분석') {
                      setInput(item.input);
                    }
                    setTimeout(() => {
                      document.getElementById('result-box')?.scrollIntoView({ behavior: 'smooth' });
                    }, 80);
                  }}
                  className={`group text-left p-4 rounded-2xl bg-white border transition-all duration-300 hover:border-teal-400 hover:shadow-md cursor-pointer flex flex-col justify-between h-32 relative ${
                    result === item.result ? 'border-teal-500 ring-2 ring-teal-100' : 'border-slate-200'
                  }`}
                >
                  <div className="w-full">
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="text-[10px] font-semibold text-slate-400 font-mono">{item.timestamp}</span>
                      <span className="text-[10px] bg-teal-50 text-teal-700 font-bold px-2 py-0.5 rounded-full">
                        치료 {item.days}일차
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-700 line-clamp-2 leading-snug group-hover:text-teal-700 transition-colors">
                      {item.input}
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between w-full mt-2 pt-2 border-t border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5">
                      {item.hasImage && <ImageIcon className="w-3 h-3 text-slate-400 flex-shrink-0" />}
                      리포트 불러오기
                    </span>
                    <span className="text-teal-600 font-bold text-xs group-hover:translate-x-0.5 transition-transform">→</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Toggleable Safe Ingredients Dictionary Section */}
        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-4 sm:p-6 mb-8 transition-all relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-teal-600"></div>
          
          <button 
            onClick={() => setShowDict(!showDict)}
            className="w-full flex items-center justify-between text-left focus:outline-none"
            id="toggle-dictionary-btn"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-50 rounded-xl text-teal-600">
                <BookMarked className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="font-black text-slate-800 text-xs sm:text-sm md:text-base leading-tight">
                  보영 안심 생태 식단 사전 (EBM 맞춤 조회)
                </h3>
                <p className="text-slate-400 text-xs md:text-sm mt-0.5 font-medium">
                  원재료 분석 전에 특정/좋은/보통/금기 식품 정보를 빠르게 직접 조회하고 찾아보세요.
                </p>
              </div>
            </div>
            <div className="p-1.5 hover:bg-slate-50 rounded-full transition-colors text-slate-400">
              {showDict ? <ChevronUp className="w-5 h-5 text-teal-600" /> : <ChevronDown className="w-5 h-5" />}
            </div>
          </button>

          {showDict && (
            <div className="mt-6 pt-6 border-t border-slate-100 animate-in fade-in duration-300">
              
              {/* Search Bar & Filters */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6">
                
                {/* Search query input */}
                <div className="md:col-span-4 relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input 
                    type="text"
                    placeholder="식재료 검색 (예: 두부, 당근, 연어)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-400 focus:bg-white text-slate-700 placeholder:text-slate-400 transition-colors"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Sub category filter tabs */}
                <div className="md:col-span-8 flex flex-wrap gap-1.5">
                  <button 
                    onClick={() => setCatFilter('all')}
                    className={`px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
                      catFilter === 'all' 
                        ? 'bg-slate-800 text-white' 
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    전체 ({DICTIONARY_ITEMS.length})
                  </button>
                  <button 
                    onClick={() => setCatFilter('specific')}
                    className={`px-3 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1 ${
                      catFilter === 'specific' 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    🌟 특정식품 ({DICTIONARY_ITEMS.filter(i => i.category === 'specific').length})
                  </button>
                  <button 
                    onClick={() => setCatFilter('good')}
                    className={`px-3 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1 ${
                      catFilter === 'good' 
                        ? 'bg-green-600 text-white' 
                        : 'bg-green-50 hover:bg-green-100 text-green-700'
                    }`}
                  >
                    🍏 좋은식품 ({DICTIONARY_ITEMS.filter(i => i.category === 'good').length})
                  </button>
                  <button 
                    onClick={() => setCatFilter('normal')}
                    className={`px-3 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1 ${
                      catFilter === 'normal' 
                        ? 'bg-amber-500 text-white' 
                        : 'bg-amber-50 hover:bg-amber-100/80 text-amber-700'
                    }`}
                  >
                    💡 보통식품 ({DICTIONARY_ITEMS.filter(i => i.category === 'normal').length})
                  </button>
                  <button 
                    onClick={() => setCatFilter('forbidden')}
                    className={`px-3 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1 ${
                      catFilter === 'forbidden' 
                        ? 'bg-rose-600 text-white' 
                        : 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                    }`}
                  >
                    ⚠️ 금기식품 ({DICTIONARY_ITEMS.filter(i => i.category === 'forbidden').length})
                  </button>
                </div>

              </div>

              {/* Food Type Scrollable Chips */}
              <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-5 border-b border-slate-100 scrollbar-none">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex-shrink-0">분류별:</span>
                {DICTIONARY_TYPES.map((typeObj) => (
                  <button 
                    key={typeObj.id}
                    onClick={() => setTypeFilter(typeObj.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                      typeFilter === typeObj.id 
                        ? 'bg-teal-600 border-teal-600 text-white shadow-sm' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{typeObj.emoji}</span>
                    <span>{typeObj.name}</span>
                  </button>
                ))}
              </div>

              {/* Items Render Area */}
              {filteredItems.length === 0 ? (
                <div className="text-center py-10 bg-slate-50/50 rounded-2xl border border-slate-200/50">
                  <p className="text-slate-400 text-sm font-medium">검색 결과와 일치하는 식재료가 사전에 없습니다.</p>
                  <button 
                    onClick={() => { setSearchQuery(''); setTypeFilter('all'); setCatFilter('all'); }} 
                    className="mt-3 text-xs text-teal-600 font-bold hover:underline"
                  >
                    필터 전체 초기화
                  </button>
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[360px] overflow-y-auto pr-1">
                    {filteredItems.map((item, idx) => {
                      let badgeStyle = '';
                      let dotStyle = '';
                      let textTag = '';
                      
                      switch (item.category) {
                        case 'specific':
                          badgeStyle = 'bg-emerald-50/50 border-emerald-100/70 text-emerald-800';
                          dotStyle = 'bg-emerald-500';
                          textTag = '특정식품';
                          break;
                        case 'good':
                          badgeStyle = 'bg-green-50/50 border-green-100/70 text-green-800';
                          dotStyle = 'bg-green-500';
                          textTag = '좋은식품';
                          break;
                        case 'normal':
                          badgeStyle = 'bg-amber-50/50 border-amber-100/70 text-amber-800';
                          dotStyle = 'bg-amber-500';
                          textTag = '보통식품';
                          break;
                        case 'forbidden':
                          badgeStyle = 'bg-rose-50/40 border-rose-100/50 text-rose-800';
                          dotStyle = 'bg-rose-500';
                          textTag = '금기식품';
                          break;
                      }

                      return (
                        <div 
                          key={`${item.name}-${idx}`}
                          className={`p-3 rounded-2xl border flex flex-col justify-between transition-all hover:shadow-sm ${badgeStyle}`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-bold opacity-80 uppercase tracking-widest">{textTag}</span>
                              <span className={`w-2 h-2 rounded-full ${dotStyle}`}></span>
                            </div>
                            <h4 className="font-bold text-slate-800 text-sm">{item.name}</h4>
                          </div>
                          {item.desc && (
                            <p className="text-[10px] leading-tight text-slate-500 mt-1.5 font-medium">
                              {item.desc}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Legend Info details banner */}
                  <div className="mt-4 p-4 bg-teal-50/50 rounded-2xl border border-teal-100/50 flex gap-3 text-xs text-teal-800 leading-relaxed">
                    <HelpCircle className="w-5 h-5 flex-shrink-0 text-teal-600 mt-0.5 select-none" />
                    <div>
                      <strong className="font-bold">식단 안심 판정 기준 안내:</strong> 
                      <p className="mt-1 text-teal-900/85">
                        • <strong>🌟 특정식품 / 🍏 좋은식품</strong>만을 이용하여 만든 식사는 <strong className="text-emerald-700">🍏 안전</strong>으로 판정됩니다.<br />
                        • 만약 <strong>💡 보통식품</strong>이 단 하나라도 포함되어 있다면, 과식을 주의하라는 의미로 <strong className="text-amber-600">💡 주의 필요</strong> 판정이 내려집니다.<br />
                        • 만약 <strong>⚠️ 금기식품</strong>이 단 하나라도 포함되어 있다면, 무조건 <strong className="text-rose-600">⚠️ 섭취 불가</strong> 판정으로 안전이 전면 제한됩니다.
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

      </main>
    </div>
  );
}

