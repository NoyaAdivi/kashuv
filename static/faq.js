/* FAQ content for noya-app.js */
window.NOYA_FAQ = {
 "topics": [
  {
   "id": "live",
   "icon": "🎧",
   "he": "זום חי",
   "en": "Live Zoom"
  },
  {
   "id": "rec",
   "icon": "🎬",
   "he": "הקלטות",
   "en": "Recordings"
  },
  {
   "id": "sum",
   "icon": "✨",
   "he": "סיכומים",
   "en": "Summaries"
  },
  {
   "id": "setup",
   "icon": "🛠️",
   "he": "התקנה ופרטיות",
   "en": "Setup and privacy"
  },
  {
   "id": "app",
   "icon": "📲",
   "he": "אפליקציה",
   "en": "App"
  }
 ],
 "items": [
  {
   "t": "live",
   "he": [
    "איך Kashuv שומעת את הזום?",
    "היא מקשיבה לשמע שהמחשב משמיע, כך שזה עובד עם אפליקציית זום, זום בדפדפן ו-Google Meet. אפשר להוסיף גם את המיקרופון שלכם."
   ],
   "en": [
    "How does Kashuv hear the Zoom?",
    "It listens to the sound your computer plays, so it works with the Zoom app, Zoom in the browser, Google Meet and Teams, with speakers, wired or Bluetooth headphones. You can add your microphone too."
   ]
  },
  {
   "t": "live",
   "he": [
    "מה זה \"מה פספסתי?\"",
    "לחיצה אחת נותנת סיכום של 2, 5 או 10 הדקות האחרונות. מושלם אחרי שיחת טלפון או כשהראש נדד."
   ],
   "en": [
    "What is \"What did I miss?\"",
    "One click gives you a summary of the last 2, 5 or 10 minutes. Perfect after a phone call or when your mind wandered."
   ]
  },
  {
   "t": "live",
   "he": [
    "איך עובדת ההתראה כשקוראים לי?",
    "כותבים את השם שלכם לפני ההתחלה, וכשמישהו אומר אותו קופצת התראה עם מה שנאמר."
   ],
   "en": [
    "How does the alert work when someone calls my name?",
    "Type your name before you start, and when someone says it an alert pops up with what was said."
   ]
  },
  {
   "t": "live",
   "he": [
    "מה עושה מצב ריכוז?",
    "מסתיר את התמלול המלא ומשאיר רק את מה שחשוב: הנושא הנוכחי, הנקודות המרכזיות ושאלות ומשימות."
   ],
   "en": [
    "What does focus mode do?",
    "It hides the full transcript and keeps only what matters: the current topic, the key points, and questions and tasks."
   ]
  },
  {
   "t": "rec",
   "he": [
    "אילו קבצים אפשר להעלות?",
    "mp4, m4a, mp3, wav ועוד. גוררים את ההקלטה, בוחרים שפה ומקבלים תמלול וסיכום מלא. אפשר לסגור את החלון ולחזור, הכל נשמר."
   ],
   "en": [
    "Which files can I upload?",
    "mp4, m4a, mp3, wav and more. Drop the recording, pick a language and get a full transcript and summary. You can close the window and come back, everything is saved."
   ]
  },
  {
   "t": "sum",
   "he": [
    "מה יש בסיכום?",
    "מה חשוב למבחן, מושגים, משימות, שאלות שעלו, כרטיסי תרגול, ציר זמן ותמלול מלא עם חיפוש. אפשר גם לשאול את ההקלטה שאלות."
   ],
   "en": [
    "What is in a summary?",
    "What matters for the exam, concepts, tasks, open questions, practice cards, a timeline and a full searchable transcript. You can also ask the recording questions."
   ]
  },
  {
   "t": "sum",
   "he": [
    "למה אין לי סיכום?",
    "הסיכומים נוצרים עם Ollama. אם הוא לא פועל או שהמודל חסר, התמלול נשמר ואפשר ללחוץ \"סיכום מחדש\" אחרי שמפעילים אותו."
   ],
   "en": [
    "Why don't I have a summary?",
    "Summaries are made with Ollama. If it is not running or the model is missing, the transcript is still saved and you can press \"Summarize again\" once it is on."
   ]
  },
  {
   "t": "setup",
   "he": [
    "זה באמת חינם?",
    "כן. התמלול רץ עם מודל העברית של ivrit.ai והסיכומים עם Ollama, הכל במחשב שלכם בלי מנוי ובלי ענן."
   ],
   "en": [
    "Is it really free?",
    "Yes. Transcription runs with the Hebrew model by ivrit.ai and summaries with Ollama, all on your computer, with no subscription and no cloud."
   ]
  },
  {
   "t": "setup",
   "he": [
    "ההקלטות עולות לאינטרנט?",
    "לא. הכל נשמר רק במחשב שלכם. חשוב לספר למשתתפים ולמרצה שאתם מקליטים ומתמללים."
   ],
   "en": [
    "Are my recordings uploaded?",
    "No. Everything stays on your computer only. Remember to tell the participants and the lecturer that you are recording."
   ]
  },
  {
   "t": "setup",
   "he": [
    "איך מפעילים?",
    "לוחצים פעמיים על start.bat. בפעם הראשונה הוא מתקין הכל לבד, ואז האפליקציה נפתחת בדפדפן. בשביל סיכומים מתקינים את Ollama ומריצים: ollama pull gemma3:4b. כל השלבים מופיעים ב-README."
   ],
   "en": [
    "How do I start it?",
    "Double click start.bat. The first run installs everything by itself, then the app opens in your browser. For summaries, install Ollama and run: ollama pull gemma3:4b. All the steps are in the README."
   ]
  },
  {
   "t": "app",
   "he": [
    "אפשר להתקין את Kashuv כאפליקציה?",
    "כן. כשהאתר פתוח בכרום או באדג׳ לוחצים על כפתור ההתקנה בתחתית המסך או בשורת הכתובת, ו-Kashuv נפתחת בחלון משלה עם אייקון משלה."
   ],
   "en": [
    "Can I install Kashuv as an app?",
    "Yes. With the site open in Chrome or Edge, press the install button at the bottom of the screen or in the address bar, and Kashuv opens in its own window with its own icon."
   ]
  }
 ]
};
