-- Issue #16: Diversify seed correct_choice_index so a missing shuffle
-- cannot hide behind every answer living at index 0.
-- Do not edit 003_seed_packs.sql; this UPDATE rewrites already-seeded rows.
-- Pattern per pack (sort_order 1..5): 0, 1, 2, 0, 1
-- choices_by_lang is rotated so the translation text sits at the new index
-- in all 8 locales.

-- survival sort 1 arigatou -> index 0
update public.phrases
set
  choices_by_lang = $json${"en":["Thank you","Sorry","Hello"],"zh-TW":["謝謝","對不起","你好"],"zh-CN":["谢谢","对不起","你好"],"ko":["감사합니다","미안합니다","안녕하세요"],"th":["ขอบคุณ","ขอโทษ","สวัสดี"],"fr":["Merci","Désolé","Bonjour"],"de":["Danke","Entschuldigung","Hallo"],"es":["Gracias","Lo siento","Hola"]}$json$::jsonb,
  correct_choice_index = 0
where id = 'a1111111-1111-4111-8111-111111111111';

-- survival sort 2 sumimasen -> index 1
update public.phrases
set
  choices_by_lang = $json${"en":["Good night","Excuse me","Thank you"],"zh-TW":["晚安","不好意思","謝謝"],"zh-CN":["晚安","不好意思","谢谢"],"ko":["안녕히 주무세요","실례합니다","감사합니다"],"th":["ราตรีสวัสดิ์","ขอโทษนะครับ","ขอบคุณ"],"fr":["Bonne nuit","Excusez-moi","Merci"],"de":["Gute Nacht","Entschuldigung","Danke"],"es":["Buenas noches","Perdón","Gracias"]}$json$::jsonb,
  correct_choice_index = 1
where id = 'a1111111-1111-4111-8111-111111111112';

-- survival sort 3 mizu o kudasai -> index 2
update public.phrases
set
  choices_by_lang = $json${"en":["Check please","Good morning","Water, please"],"zh-TW":["請結帳","早安","請給我水"],"zh-CN":["请结账","早安","请给我水"],"ko":["계산해 주세요","안녕하세요","물 주세요"],"th":["เช็คบิล","อรุณสวัสดิ์","ขอน้ำหน่อย"],"fr":["L'addition","Bonjour","De l'eau, s'il vous plaît"],"de":["Die Rechnung bitte","Guten Morgen","Wasser bitte"],"es":["La cuenta","Buenos días","Agua, por favor"]}$json$::jsonb,
  correct_choice_index = 2
where id = 'a1111111-1111-4111-8111-111111111113';

-- survival sort 4 hai -> index 0
update public.phrases
set
  choices_by_lang = $json${"en":["Yes","No","Maybe"],"zh-TW":["是","不是","也許"],"zh-CN":["是","不是","也许"],"ko":["네","아니요","아마도"],"th":["ครับ/ค่ะ","ไม่","อาจจะ"],"fr":["Oui","Non","Peut-être"],"de":["Ja","Nein","Vielleicht"],"es":["Sí","No","Quizá"]}$json$::jsonb,
  correct_choice_index = 0
where id = 'a1111111-1111-4111-8111-111111111114';

-- survival sort 5 toire wa doko desu ka -> index 1
update public.phrases
set
  choices_by_lang = $json${"en":["Where is the station?","Where is the toilet?","How much is this?"],"zh-TW":["車站在哪裡？","廁所在哪裡？","這個多少錢？"],"zh-CN":["车站在哪里？","厕所在哪里？","这个多少钱？"],"ko":["역이 어디예요?","화장실이 어디예요?","이거 얼마예요?"],"th":["สถานีอยู่ที่ไหน","ห้องน้ำอยู่ที่ไหน","อันนี้เท่าไหร่"],"fr":["Où est la gare ?","Où sont les toilettes ?","Combien ça coûte ?"],"de":["Wo ist der Bahnhof?","Wo ist die Toilette?","Was kostet das?"],"es":["¿Dónde está la estación?","¿Dónde está el baño?","¿Cuánto cuesta?"]}$json$::jsonb,
  correct_choice_index = 1
where id = 'a1111111-1111-4111-8111-111111111115';

-- travel sort 1 ikura desu ka -> index 0
update public.phrases
set
  choices_by_lang = $json${"en":["How much is it?","Where is it?","What time is it?"],"zh-TW":["這多少錢？","在哪裡？","幾點了？"],"zh-CN":["这多少钱？","在哪里？","几点了？"],"ko":["얼마예요?","어디예요?","몇 시예요?"],"th":["เท่าไหร่","อยู่ที่ไหน","กี่โมง"],"fr":["Combien ça coûte ?","Où est-ce ?","Quelle heure est-il ?"],"de":["Was kostet das?","Wo ist das?","Wie spät ist es?"],"es":["¿Cuánto cuesta?","¿Dónde está?","¿Qué hora es?"]}$json$::jsonb,
  correct_choice_index = 0
where id = 'b2222222-2222-4222-8222-222222222221';

-- travel sort 2 eki wa doko desu ka -> index 1
update public.phrases
set
  choices_by_lang = $json${"en":["I am lost","Where is the station?","Where is the toilet?"],"zh-TW":["我迷路了","車站在哪裡？","廁所在哪裡？"],"zh-CN":["我迷路了","车站在哪里？","厕所在哪里？"],"ko":["길을 잃었어요","역이 어디예요?","화장실이 어디예요?"],"th":["ฉันหลงทาง","สถานีอยู่ที่ไหน","ห้องน้ำอยู่ที่ไหน"],"fr":["Je suis perdu","Où est la gare ?","Où sont les toilettes ?"],"de":["Ich habe mich verlaufen","Wo ist der Bahnhof?","Wo ist die Toilette?"],"es":["Estoy perdido","¿Dónde está la estación?","¿Dónde está el baño?"]}$json$::jsonb,
  correct_choice_index = 1
where id = 'b2222222-2222-4222-8222-222222222222';

-- travel sort 3 oishii -> index 2
update public.phrases
set
  choices_by_lang = $json${"en":["Spicy","Expensive","Delicious"],"zh-TW":["辣","貴","好吃"],"zh-CN":["辣","贵","好吃"],"ko":["매워요","비싸요","맛있어요"],"th":["เผ็ด","แพง","อร่อย"],"fr":["Épicé","Cher","Délicieux"],"de":["Scharf","Teuer","Lecker"],"es":["Picante","Caro","Delicioso"]}$json$::jsonb,
  correct_choice_index = 2
where id = 'b2222222-2222-4222-8222-222222222223';

-- travel sort 4 tasukete -> index 0
update public.phrases
set
  choices_by_lang = $json${"en":["Help","Wait","Stop"],"zh-TW":["救命","等一下","停"],"zh-CN":["救命","等一下","停"],"ko":["도와주세요","잠깐만요","멈춰요"],"th":["ช่วยด้วย","รอ","หยุด"],"fr":["Au secours","Attendez","Stop"],"de":["Hilfe","Warten","Stopp"],"es":["Ayuda","Espera","Alto"]}$json$::jsonb,
  correct_choice_index = 0
where id = 'b2222222-2222-4222-8222-222222222224';

-- travel sort 5 eigo ga hanasemasu ka -> index 1
update public.phrases
set
  choices_by_lang = $json${"en":["What is your name?","Do you speak English?","Do you speak Japanese?"],"zh-TW":["你叫什麼名字？","你會說英語嗎？","你會說日語嗎？"],"zh-CN":["你叫什么名字？","你会说英语吗？","你会说日语吗？"],"ko":["이름이 뭐예요?","영어 할 수 있어요?","일본어 할 수 있어요?"],"th":["คุณชื่ออะไร","พูดภาษาอังกฤษได้ไหม","พูดภาษาญี่ปุ่นได้ไหม"],"fr":["Comment vous appelez-vous ?","Parlez-vous anglais ?","Parlez-vous japonais ?"],"de":["Wie heißen Sie?","Sprechen Sie Englisch?","Sprechen Sie Japanisch?"],"es":["¿Cómo se llama?","¿Habla inglés?","¿Habla japonés?"]}$json$::jsonb,
  correct_choice_index = 1
where id = 'b2222222-2222-4222-8222-222222222225';
