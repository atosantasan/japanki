insert into public.content_packs (id, title, description, is_free, price_usd)
values
  (
    'survival',
    '{"en":"Survival","zh-TW":"生存必備","zh-CN":"生存必备","ko":"생존 필수","th":"เอาตัวรอด","fr":"Survie","de":"Überleben","es":"Supervivencia"}'::jsonb,
    '{"en":"Five must-know phrases","zh-TW":"五句必備短語","zh-CN":"五句必备短语","ko":"필수 5문장","th":"ห้าประโยคต้องรู้","fr":"Cinq phrases essentielles","de":"Fünf Pflichtsätze","es":"Cinco frases esenciales"}'::jsonb,
    true,
    0.00
  ),
  (
    'travel',
    '{"en":"Travel","zh-TW":"旅行","zh-CN":"旅行","ko":"여행","th":"ท่องเที่ยว","fr":"Voyage","de":"Reise","es":"Viaje"}'::jsonb,
    '{"en":"Paid travel pack","zh-TW":"付費旅行包","zh-CN":"付费旅行包","ko":"유료 여행 팩","th":"แพ็กท่องเที่ยวแบบเสียเงิน","fr":"Pack voyage payant","de":"Kostenpflichtiges Reisepaket","es":"Pack de viaje de pago"}'::jsonb,
    false,
    2.99
  );

insert into public.phrases (
  id, pack_id, romaji, japanese, audio_url, translations, choices_by_lang, correct_choice_index, sort_order
) values
(
  'a1111111-1111-4111-8111-111111111111',
  'survival',
  'arigatou',
  'ありがとう',
  '/audio/arigatou.mp3',
  '{"en":"Thank you","zh-TW":"謝謝","zh-CN":"谢谢","ko":"감사합니다","th":"ขอบคุณ","fr":"Merci","de":"Danke","es":"Gracias"}'::jsonb,
  '{"en":["Thank you","Sorry","Hello"],"zh-TW":["謝謝","對不起","你好"],"zh-CN":["谢谢","对不起","你好"],"ko":["감사합니다","미안합니다","안녕하세요"],"th":["ขอบคุณ","ขอโทษ","สวัสดี"],"fr":["Merci","Désolé","Bonjour"],"de":["Danke","Entschuldigung","Hallo"],"es":["Gracias","Lo siento","Hola"]}'::jsonb,
  0,
  1
),
(
  'a1111111-1111-4111-8111-111111111112',
  'survival',
  'sumimasen',
  'すみません',
  '/audio/sumimasen.mp3',
  '{"en":"Excuse me","zh-TW":"不好意思","zh-CN":"不好意思","ko":"실례합니다","th":"ขอโทษนะครับ","fr":"Excusez-moi","de":"Entschuldigung","es":"Perdón"}'::jsonb,
  '{"en":["Excuse me","Thank you","Good night"],"zh-TW":["不好意思","謝謝","晚安"],"zh-CN":["不好意思","谢谢","晚安"],"ko":["실례합니다","감사합니다","안녕히 주무세요"],"th":["ขอโทษนะครับ","ขอบคุณ","ราตรีสวัสดิ์"],"fr":["Excusez-moi","Merci","Bonne nuit"],"de":["Entschuldigung","Danke","Gute Nacht"],"es":["Perdón","Gracias","Buenas noches"]}'::jsonb,
  0,
  2
),
(
  'a1111111-1111-4111-8111-111111111113',
  'survival',
  'mizu o kudasai',
  '水をください',
  '/audio/mizu.mp3',
  '{"en":"Water, please","zh-TW":"請給我水","zh-CN":"请给我水","ko":"물 주세요","th":"ขอน้ำหน่อย","fr":"De l''eau, s''il vous plaît","de":"Wasser bitte","es":"Agua, por favor"}'::jsonb,
  '{"en":["Water, please","Check please","Good morning"],"zh-TW":["請給我水","請結帳","早安"],"zh-CN":["请给我水","请结账","早安"],"ko":["물 주세요","계산해 주세요","안녕하세요"],"th":["ขอน้ำหน่อย","เช็คบิล","อรุณสวัสดิ์"],"fr":["De l''eau, s''il vous plaît","L''addition","Bonjour"],"de":["Wasser bitte","Die Rechnung bitte","Guten Morgen"],"es":["Agua, por favor","La cuenta","Buenos días"]}'::jsonb,
  0,
  3
),
(
  'a1111111-1111-4111-8111-111111111114',
  'survival',
  'hai',
  'はい',
  '/audio/hai.mp3',
  '{"en":"Yes","zh-TW":"是","zh-CN":"是","ko":"네","th":"ครับ/ค่ะ","fr":"Oui","de":"Ja","es":"Sí"}'::jsonb,
  '{"en":["Yes","No","Maybe"],"zh-TW":["是","不是","也許"],"zh-CN":["是","不是","也许"],"ko":["네","아니요","아마도"],"th":["ครับ/ค่ะ","ไม่","อาจจะ"],"fr":["Oui","Non","Peut-être"],"de":["Ja","Nein","Vielleicht"],"es":["Sí","No","Quizá"]}'::jsonb,
  0,
  4
),
(
  'a1111111-1111-4111-8111-111111111115',
  'survival',
  'toire wa doko desu ka',
  'トイレはどこですか',
  '/audio/toire.mp3',
  '{"en":"Where is the toilet?","zh-TW":"廁所在哪裡？","zh-CN":"厕所在哪里？","ko":"화장실이 어디예요?","th":"ห้องน้ำอยู่ที่ไหน","fr":"Où sont les toilettes ?","de":"Wo ist die Toilette?","es":"¿Dónde está el baño?"}'::jsonb,
  '{"en":["Where is the toilet?","How much is this?","Where is the station?"],"zh-TW":["廁所在哪裡？","這個多少錢？","車站在哪裡？"],"zh-CN":["厕所在哪里？","这个多少钱？","车站在哪里？"],"ko":["화장실이 어디예요?","이거 얼마예요?","역이 어디예요?"],"th":["ห้องน้ำอยู่ที่ไหน","อันนี้เท่าไหร่","สถานีอยู่ที่ไหน"],"fr":["Où sont les toilettes ?","Combien ça coûte ?","Où est la gare ?"],"de":["Wo ist die Toilette?","Was kostet das?","Wo ist der Bahnhof?"],"es":["¿Dónde está el baño?","¿Cuánto cuesta?","¿Dónde está la estación?"]}'::jsonb,
  0,
  5
),
(
  'b2222222-2222-4222-8222-222222222221',
  'travel',
  'ikura desu ka',
  'いくらですか',
  '/audio/ikura.mp3',
  '{"en":"How much is it?","zh-TW":"這多少錢？","zh-CN":"这多少钱？","ko":"얼마예요?","th":"เท่าไหร่","fr":"Combien ça coûte ?","de":"Was kostet das?","es":"¿Cuánto cuesta?"}'::jsonb,
  '{"en":["How much is it?","Where is it?","What time is it?"],"zh-TW":["這多少錢？","在哪裡？","幾點了？"],"zh-CN":["这多少钱？","在哪里？","几点了？"],"ko":["얼마예요?","어디예요?","몇 시예요?"],"th":["เท่าไหร่","อยู่ที่ไหน","กี่โมง"],"fr":["Combien ça coûte ?","Où est-ce ?","Quelle heure est-il ?"],"de":["Was kostet das?","Wo ist das?","Wie spät ist es?"],"es":["¿Cuánto cuesta?","¿Dónde está?","¿Qué hora es?"]}'::jsonb,
  0,
  1
),
(
  'b2222222-2222-4222-8222-222222222222',
  'travel',
  'eki wa doko desu ka',
  '駅はどこですか',
  '/audio/eki.mp3',
  '{"en":"Where is the station?","zh-TW":"車站在哪裡？","zh-CN":"车站在哪里？","ko":"역이 어디예요?","th":"สถานีอยู่ที่ไหน","fr":"Où est la gare ?","de":"Wo ist der Bahnhof?","es":"¿Dónde está la estación?"}'::jsonb,
  '{"en":["Where is the station?","Where is the toilet?","I am lost"],"zh-TW":["車站在哪裡？","廁所在哪裡？","我迷路了"],"zh-CN":["车站在哪里？","厕所在哪里？","我迷路了"],"ko":["역이 어디예요?","화장실이 어디예요?","길을 잃었어요"],"th":["สถานีอยู่ที่ไหน","ห้องน้ำอยู่ที่ไหน","ฉันหลงทาง"],"fr":["Où est la gare ?","Où sont les toilettes ?","Je suis perdu"],"de":["Wo ist der Bahnhof?","Wo ist die Toilette?","Ich habe mich verlaufen"],"es":["¿Dónde está la estación?","¿Dónde está el baño?","Estoy perdido"]}'::jsonb,
  0,
  2
),
(
  'b2222222-2222-4222-8222-222222222223',
  'travel',
  'oishii',
  'おいしい',
  '/audio/oishii.mp3',
  '{"en":"Delicious","zh-TW":"好吃","zh-CN":"好吃","ko":"맛있어요","th":"อร่อย","fr":"Délicieux","de":"Lecker","es":"Delicioso"}'::jsonb,
  '{"en":["Delicious","Spicy","Expensive"],"zh-TW":["好吃","辣","貴"],"zh-CN":["好吃","辣","贵"],"ko":["맛있어요","매워요","비싸요"],"th":["อร่อย","เผ็ด","แพง"],"fr":["Délicieux","Épicé","Cher"],"de":["Lecker","Scharf","Teuer"],"es":["Delicioso","Picante","Caro"]}'::jsonb,
  0,
  3
),
(
  'b2222222-2222-4222-8222-222222222224',
  'travel',
  'tasukete',
  '助けて',
  '/audio/tasukete.mp3',
  '{"en":"Help","zh-TW":"救命","zh-CN":"救命","ko":"도와주세요","th":"ช่วยด้วย","fr":"Au secours","de":"Hilfe","es":"Ayuda"}'::jsonb,
  '{"en":["Help","Wait","Stop"],"zh-TW":["救命","等一下","停"],"zh-CN":["救命","等一下","停"],"ko":["도와주세요","잠깐만요","멈춰요"],"th":["ช่วยด้วย","รอ","หยุด"],"fr":["Au secours","Attendez","Stop"],"de":["Hilfe","Warten","Stopp"],"es":["Ayuda","Espera","Alto"]}'::jsonb,
  0,
  4
),
(
  'b2222222-2222-4222-8222-222222222225',
  'travel',
  'eigo ga hanasemasu ka',
  '英語が話せますか',
  '/audio/eigo.mp3',
  '{"en":"Do you speak English?","zh-TW":"你會說英語嗎？","zh-CN":"你会说英语吗？","ko":"영어 할 수 있어요?","th":"พูดภาษาอังกฤษได้ไหม","fr":"Parlez-vous anglais ?","de":"Sprechen Sie Englisch?","es":"¿Habla inglés?"}'::jsonb,
  '{"en":["Do you speak English?","Do you speak Japanese?","What is your name?"],"zh-TW":["你會說英語嗎？","你會說日語嗎？","你叫什麼名字？"],"zh-CN":["你会说英语吗？","你会说日语吗？","你叫什么名字？"],"ko":["영어 할 수 있어요?","일본어 할 수 있어요?","이름이 뭐예요?"],"th":["พูดภาษาอังกฤษได้ไหม","พูดภาษาญี่ปุ่นได้ไหม","คุณชื่ออะไร"],"fr":["Parlez-vous anglais ?","Parlez-vous japonais ?","Comment vous appelez-vous ?"],"de":["Sprechen Sie Englisch?","Sprechen Sie Japanisch?","Wie heißen Sie?"],"es":["¿Habla inglés?","¿Habla japonés?","¿Cómo se llama?"]}'::jsonb,
  0,
  5
);
