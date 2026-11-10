import test from 'node:test';
import assert from 'node:assert/strict';
import { SpeechDirector, WELCOME_TEMPLATES, GIFT_TEMPLATES } from '../server/speech.js';

test('SpeechDirector: getWelcomeSpeech sinh lời chào trang nghiêm và thay thế tên chính xác', () => {
  const director = new SpeechDirector();
  const speech = director.getWelcomeSpeech({ nickname: 'Minh An', username: 'minhan123' });
  assert.equal(speech.type, 'welcome');
  assert.ok(speech.text.includes('Minh An'));
  assert.ok(!speech.text.includes('{name}'));
  assert.ok(!speech.text.includes('{username}'));
});

test('SpeechDirector: chống lặp câu chào - không lặp lại câu trong cửa sổ lịch sử gần nhất', () => {
  const director = new SpeechDirector();
  const historySize = 8;
  const pickedIndices = [];
  for (let i = 0; i < historySize; i++) {
    const s = director.getWelcomeSpeech({ nickname: `User_${i}` });
    assert.ok(!pickedIndices.includes(s.index), `Câu index ${s.index} bị lặp lại trong ${historySize} lượt đầu!`);
    pickedIndices.push(s.index);
  }
  assert.equal(pickedIndices.length, historySize);
});

test('SpeechDirector: phân loại danh mục quà tặng chính xác (love, peace, health, luck, ceremony, general)', () => {
  const director = new SpeechDirector();
  assert.equal(director.detectGiftCategory({ name: 'Hoa hồng', id: 'rose' }), 'love');
  assert.equal(director.detectGiftCategory({ name: 'Bắn tim', id: 'heart' }), 'love');
  assert.equal(director.detectGiftCategory({ name: 'Bó hoa', id: 'flower' }), 'peace');
  assert.equal(director.detectGiftCategory({ name: 'Hoa sen', id: 'lotus' }), 'peace');
  assert.equal(director.detectGiftCategory({ name: 'Bó hoa mùa xuân' }), 'health');
  assert.equal(director.detectGiftCategory({ name: 'Yêu bạn' }), 'luck');
  assert.equal(director.detectGiftCategory({ name: 'Cỏ bốn lá 10xu' }), 'luck');
  assert.equal(director.detectGiftCategory({ name: 'Chuông chùa', id: 'bell' }), 'ceremony');
  assert.equal(director.detectGiftCategory({ name: 'Sư Tử', id: 'lion' }), 'ceremony');
  assert.equal(director.detectGiftCategory({ name: 'Món quà bất kỳ' }), 'general');
});

test('SpeechDirector: getGiftThankYouSpeech tạo lời cảm ơn phù hợp với quà tặng và số lượng repeat', () => {
  const director = new SpeechDirector();
  const gift = { name: 'Hoa hồng', id: 'rose' };
  const speech = director.getGiftThankYouSpeech({ nickname: 'Thiện Tùng' }, gift, 5);
  assert.equal(speech.type, 'gift_thanks');
  assert.equal(speech.category, 'love');
  assert.ok(speech.text.includes('Thiện Tùng'));
  assert.ok(speech.text.includes('Hoa hồng ×5'));
  assert.ok(!speech.text.includes('{name}'));
  assert.ok(!speech.text.includes('{gift}'));
});

test('SpeechDirector: getAmbientSpeech sinh lời chúc an lạc định kỳ cho chế độ Treo Live 24/7 và chống lặp', () => {
  const director = new SpeechDirector();
  const speech = director.getAmbientSpeech();
  assert.equal(speech.type, 'ambient_blessing');
  assert.ok(typeof speech.text === 'string' && speech.text.length > 10);
  assert.ok(speech.text.includes('A Di Đà Phật') || speech.text.includes('Phật') || speech.text.includes('Bồ Tát'));

  // Kiểm tra chống lặp trong 6 lượt liên tiếp
  const historySize = 6;
  const picked = [speech.index];
  for (let i = 1; i < historySize; i++) {
    const next = director.getAmbientSpeech();
    assert.ok(!picked.includes(next.index), `Câu ambient index ${next.index} bị lặp lại!`);
    picked.push(next.index);
  }
  assert.equal(picked.length, historySize);
});
