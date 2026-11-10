// server/speech.js - Kho lời nói AI trang nghiêm, ấm áp và thuật toán chống lặp
const clean = (value, max = 256) => String(value ?? '').trim().slice(0, max);

/**
 * 25 mẫu lời chào mừng thiện hữu khi vào phòng / vào chùa
 * Tránh nhàm chán, câu từ thanh tao, đậm chất thiền môn và an lạc
 */
export const WELCOME_TEMPLATES = [
  'A Di Đà Phật, chào mừng bạn {name} đã ghé thăm chùa. Chúc bạn một ngày an lạc và vạn sự cát tường.',
  'Chào mừng thiện hữu {name} đã đến chiêm bái chốn thiền môn. Nguyện cho thân tâm bạn luôn an yên, nhẹ nhàng.',
  'Xin kính chào bạn {name}. Chúc bạn cùng gia đình luôn tràn đầy sức khỏe, bình an và hạnh phúc.',
  'A Di Đà Phật, hoan hỷ đón chào {name} ghé chùa gieo duyên lành. Nguyện mọi điều may mắn sẽ luôn mỉm cười với bạn.',
  'Chào bạn {name} à, chào mừng bạn ghé chùa. Mong bạn có những phút giây thư thái và tìm thấy niềm vui trong những điều giản dị.',
  'Chào mừng bạn {name} đã về với cửa chùa thanh tịnh. Nguyện ánh sáng từ bi xua tan mọi âu lo, muộn phiền.',
  'Kính chúc thiện hữu {name} một ngày thân khỏe tâm an, công việc thuận lợi, vạn sự hanh thông.',
  'A Di Đà Phật, chào mừng bạn {name}. Cầu mong mười phương chư Phật gia hộ cho bạn vạn dặm bình an.',
  'Hoan hỷ chào đón bạn {name}. Chúc bạn tìm được sự tĩnh tại và thanh thản nơi cửa Phật linh thiêng.',
  'Chào bạn {name}, chúc bạn luôn gặp thiện duyên, tâm luôn hoan hỷ và nụ cười luôn nở trên môi.',
  'A Di Đà Phật, chào mừng bạn {name} ghé chùa. Cầu chúc cho bạn và gia quyến vạn sự như ý, cát tường an khang.',
  'Chào mừng bạn {name} ghé chốn cửa thiền. Chúc tâm hồn bạn luôn thanh khiết và nhẹ nhõm như hoa sen sớm mai.',
  'A Di Đà Phật, hoan hỷ chào bạn {name}. Chúc bạn một ngày ngập tràn niềm vui, công việc như ý.',
  'Chào bạn {name}, chúc bạn bước vào chùa lòng thanh thản, bước ra đời gặt hái muôn vàn bình an và may mắn.',
  'A Di Đà Phật, kính chào thiện hữu {name}. Nguyện cho mọi ước nguyện lương thiện của bạn sớm thành hiện thực.',
  'Chào mừng bạn {name} đến với khóa lễ hôm nay. Chúc bạn một ngày an vui, tâm sáng trí bền.',
  'A Di Đà Phật, chào bạn {name}. Chúc bạn một ngày làm việc hanh thông, gia đạo bình an và êm ấm.',
  'Hoan hỷ đón chào {name} ghé thăm đạo tràng. Nguyện nguồn năng lượng bình an lan tỏa đến bạn và người thân.',
  'Chào bạn {name}, chúc bạn luôn có đủ niềm tin, sức khỏe và sự bình an trên mọi nẻo đường cuộc sống.',
  'A Di Đà Phật, chúc thiện hữu {name} một ngày thật an lành, vạn sự hanh thông, tâm an vạn sự an.',
  'Chào mừng thiện nam tín nữ {name}. Nguyện chúc cho bạn bồ đề tâm kiên cố, phước trí trang nghiêm.',
  'A Di Đà Phật, chào bạn {name} ghé chùa lễ Phật. Chúc bạn luôn an nhiên trước mọi sóng gió cuộc đời.',
  'Hoan hỷ chào đón bạn {name}. Nguyện chư Phật mười phương phóng quang tiếp dẫn, gia hộ cho gia quyến bạn luôn an lành.',
  'Chào bạn {name}, cảm ơn bạn đã bớt chút thời gian quý báu ghé chùa thắp nén hương tâm.',
  'A Di Đà Phật! Rất hoan hỷ khi thấy bạn {name} ghé chùa. Chúc bạn một đời bình an, không ưu tư sầu muộn.'
];

/**
 * 42 mẫu lời cảm ơn công đức cúng dường / dâng quà
 * Phân loại theo từng mục đích cầu nguyện (Duyên, Bình An, Sức Khỏe, May Mắn, Đại Lễ)
 */
export const GIFT_TEMPLATES = {
  // Cầu duyên, tình duyên (Hoa hồng, Bắn tim, Rose, Heart)
  love: [
    'A Di Đà Phật! Cảm ơn bạn {name} đã dâng {gift} cầu duyên. Nguyện cầu cho đường tình duyên của bạn sớm đơm hoa kết trái, gặp được người tâm đầu ý hợp.',
    'Tri ân {name} dâng {gift} cầu duyên lành. Kính chúc bạn sớm tìm được một nửa yêu thương, gia đạo thuận hòa, trăm năm hạnh phúc.',
    'A Di Đà Phật! Cảm ơn thiện hữu {name} đã dâng {gift} cầu tình duyên. Cầu chúc cho bạn tình duyên viên mãn, ấm êm trọn vẹn.',
    'Cảm tạ tấm lòng của {name} đã gửi tặng {gift} kết thiện duyên. Nguyện đường tình duyên của bạn gặp nhiều thuận lợi, thủy chung son sắt.',
    'A Di Đà Phật! {gift} thắm đượm chân tình cầu duyên, chúc bạn {name} sớm kết duyên lành, tình yêu viên thành như ý nguyện.',
    'Tri ân thiện hữu {name} dâng {gift} cầu tình duyên như ý. Nguyện cho bạn sớm gặp ý trung nhân, gia đình luôn đầy ắp tiếng cười và tình thương.'
  ],

  // Cầu bình an (Bó hoa, Hoa sen, Sen, Flower)
  peace: [
    'A Di Đà Phật! Cảm ơn bạn {name} đã dâng {gift} cầu bình an. Nguyện cho bạn và người thân bốn mùa luôn an vui, tai qua nạn khỏi.',
    'Tri ân {name} đã dâng {gift} cầu bình an thanh tịnh. Nguyện ơn trên che chở cho bạn một đời bình an, tâm an vạn sự an.',
    'A Di Đà Phật! Cảm ơn bạn {name} dâng {gift} cầu bình an. Chúc bạn một đời phong ba dừng sau cánh cửa, chỉ còn lại an yên và bình thản.',
    'Cảm tạ công đức của {name} dâng {gift} cầu bình an dâng lên Tam Bảo. Nguyện cho gia quyến bạn phúc ấm dài lâu, thân tâm thanh tịnh.',
    'A Di Đà Phật! Tri ân đóa {gift} thơm ngát của bạn {name} dâng cầu bình an. Cầu mong mười phương chư Phật luôn gia hộ cho bạn bình an.',
    'Xin hồi hướng công đức {gift} cầu bình an của bạn {name}. Nguyện cho mọi bão giông cuộc đời đều hóa thành mây khói nhẹ nhàng.'
  ],

  // Cầu sức khỏe (Bó hoa mùa xuân, Xuân, Sức khỏe)
  health: [
    'A Di Đà Phật! Cảm ơn bạn {name} đã dâng {gift} cầu sức khỏe. Nguyện chúc bạn thân thể tráng kiện, bệnh tật tiêu trừ, sống vui mỗi ngày.',
    'Tri ân tấm lòng của {name} dâng {gift} cầu sức khỏe mùa xuân. Chúc bạn cùng cha mẹ gia đình luôn dồi dào sinh lực, an khang trường thọ.',
    'A Di Đà Phật! Cảm ơn {name} đã dâng {gift} cầu sức khỏe. Cầu chúc cho bạn sức khỏe dẻo dai, tinh thần luôn tươi vui sảng khoái.',
    'Tấm lòng hiếu đạo và từ bi của {name} dâng {gift} cầu sức khỏe. Nguyện cho sức khỏe của bạn và người thân luôn vững vàng như núi thái sơn.',
    'A Di Đà Phật! Tri ân thiện hữu {name} dâng {gift} cầu sức khỏe. Chúc bạn thân tâm khinh an, đẩy lùi mọi phiền não tật bệnh.',
    'Cảm ơn bạn {name} dâng {gift} cầu sức khỏe. Nguyện ơn trên ban phước lành để bạn luôn khỏe mạnh, tươi vui và an lạc.'
  ],

  // Cầu may mắn, gieo quẻ (Yêu bạn, Cỏ bốn lá 10xu, Rất tốt)
  luck: [
    'A Di Đà Phật! Gieo quẻ may mắn với {gift}. Chúc bạn {name} trăm sự cát tường, cầu tài đắc tài, cầu lộc đắc lộc.',
    'Cảm ơn bạn {name} đã gửi {gift} cầu may mắn. Nguyện cầu vạn sự khởi sắc, tài lộc hanh thông, công danh rộng mở.',
    'A Di Đà Phật! Cảm ơn món quà yêu thương {gift} cầu may mắn từ bạn {name}. Chúc bạn đi đâu cũng có quý nhân phù trợ, may mắn song hành.',
    'Tri ân tấm lòng của {name} gửi tặng {gift} cầu may mắn. Nguyện cho mọi dự định làm ăn của bạn đều xuôi chèo mát mái, tài lộc dồi dào.',
    'A Di Đà Phật! Gieo quẻ lành trao {gift} cầu may mắn, chúc bạn {name} gặp nhiều may mắn bất ngờ, buôn may bán đắt, vạn sự hanh thông.',
    'Cảm ơn thiện hữu {name} đã trao gửi {gift} gieo quẻ may mắn. Nguyện chúc bạn một năm phước lộc tràn trề, công thành danh toại.'
  ],

  // Đại lễ, Chuông chùa, Sư tử (Quà trang trọng cao cấp)
  ceremony: [
    'Chuông chùa ngân vang rền khắp mười phương! Cảm tạ đại đức của bạn {name} đã phát tâm cúng dường {gift}. Nguyện phước báu lưu phương muôn đời.',
    'A Di Đà Phật! Tiếng chuông thanh tịnh đánh thức bồ đề tâm. Tri ân thiện hữu {name} đã phát tâm dâng {gift}. Chúc bạn vạn sự viên thành!',
    'Đại lễ trang nghiêm hoan hỷ! Cảm ơn tấm lòng đại công đức của bạn {name} đã dâng {gift}. Chúc bạn sự nghiệp hưng vượng, phước đức ngập tràn.',
    'A Di Đà Phật! Sư tử hộ pháp uy linh dũng mãnh, cảm tạ đại công đức của bạn {name} với món quà {gift}. Chúc bạn dũng mãnh tinh tấn, vạn sự cát tường!',
    'Tiếng chuông sớm hôm xua tan muôn phiền não. Cảm ơn bạn {name} đã phát tâm dâng {gift} công đức vô lượng!',
    'A Di Đà Phật! Đạo tràng vô cùng hoan hỷ trước đại đức cúng dường {gift} của bạn {name}. Nguyện phước báu vô lượng đời đời bền vững.'
  ],

  // Chung cho các loại quà khác
  general: [
    'A Di Đà Phật! Đạo tràng xin cảm tạ tấm lòng thành của thiện hữu {name} đã phát tâm cúng dường {gift}. Công đức vô lượng!',
    'Tri ân công đức của bạn {name} đã dâng tặng {gift}. Nguyện mười phương chư Phật chứng minh và gia hộ cho bạn vạn sự bình an.',
    'A Di Đà Phật! Cảm ơn bạn {name} đã gieo duyên lành với {gift}. Chúc bạn thân tâm an lạc, tài lộc dồi dào.',
    'Xin hồi hướng công đức lành từ {gift} của bạn {name}. Nguyện cho bạn và gia đình luôn được ấm êm, hạnh phúc.',
    'Cảm tạ tấm lòng hảo tâm của {name} đã dâng {gift}. Chúc bạn gặp nhiều may mắn, vạn sự hanh thông như ý.',
    'A Di Đà Phật! Chân thành cảm ơn thiện hữu {name}. Nguyện phước báu vô lượng luôn đồng hành cùng bạn trên mọi bước đường.',
    'Tấm lòng thành kính dâng {gift} của bạn {name} thật đáng trân quý. Cầu chúc bạn phước thọ tăng long, vạn điều như nguyện.',
    'A Di Đà Phật! Cảm ơn {name} đã dâng {gift} trang nghiêm đạo tràng. Chúc bạn tâm luôn sáng, chí luôn bền.',
    'Xin tri ân công đức cúng dường {gift} của bạn {name}. Cầu mong bạn luôn được chở che trong ánh sáng từ bi.',
    'A Di Đà Phật! Tấm lòng thảo thơm của {name} gửi trao {gift}. Nguyện bạn gieo một nhân lành, gặt hái muôn phước báu.',
    'Cảm ơn thiện hữu {name} đã phát tâm cúng dường {gift}. Nguyện cho tâm bồ đề của bạn ngày một sáng soi, cuộc sống tràn ngập niềm vui.',
    'A Di Đà Phật! Chúc bạn {name} cùng gia đình luôn dồi dào sức khỏe, bình an và nhận được muôn vàn hồng ân chư Phật.'
  ]
};

/**
 * 12 mẫu lời chúc an lạc, khuyến tấn niệm Phật và gieo duyên định kỳ (Anti-AFK 24/7)
 * Giúp phiên live luôn có giọng nói người thật thay đổi liên tục, chống thuật toán quét tĩnh
 */
export const AMBIENT_TEMPLATES = [
  'Nam Mô A Di Đà Phật. Kính chúc quý thiện nam tín nữ thập phương thân tâm luôn an lạc, gia đạo bình yên, vạn sự cát tường.',
  'Nam Mô A Di Đà Phật. Kính mời quý Phật tử cùng hoan hỷ thả tim, niệm Phật gieo duyên lành nơi chính điện.',
  'Nguyện đem công đức này, hướng về khắp tất cả, đệ tử và chúng sanh, đều trọn thành Phật đạo. Nam Mô A Di Đà Phật.',
  'Nam Mô Bổn Sư Thích Ca Mâu Ni Phật. Cầu chúc cho quý đạo hữu một ngày an vui, tĩnh tâm hướng thiện, tiêu trừ phiền não.',
  'Tiếng chuông sớm tỉnh giấc mê, ngọn đèn chánh pháp soi đường bình an. Nam Mô A Di Đà Phật, kính chúc quý vị một đời an nhiên, vạn dặm bình an.',
  'Nam Mô Quán Thế Âm Bồ Tát cứu khổ cứu nạn. Nguyện chúc mọi gia đình luôn được chở che, tai qua nạn khỏi, phúc lộc dồi dào.',
  'A Di Đà Phật. Một câu niệm Phật tiêu muôn tội, một nén hương lòng rạng ánh quang. Chúc quý đạo hữu luôn vững tâm trên con đường chánh pháp.',
  'Nam Mô A Di Đà Phật. Hoan hỷ chào đón quý Phật tử hữu duyên đang lắng lòng chiêm bái, cùng lắng nghe tiếng niệm Phật thanh tịnh nơi cửa thiền.',
  'A Di Đà Phật. Kính chúc quý thiện hữu vạn dặm bình an, mỗi bước đi đều an lạc, mỗi phút giây đều thanh thản.',
  'Nam Mô A Di Đà Phật. Nguyện cho thế giới hòa bình, nhân loại ấm no, muôn loài đều được tắm gội trong ánh sáng từ bi.',
  'Kính mời quý Phật tử cùng chắp tay niệm Nam Mô A Di Đà Phật, cầu nguyện cho cha mẹ hiện tiền tăng long phước thọ, bình an mỗi ngày.',
  'A Di Đà Phật. Tâm an vạn sự an, tâm tịnh vạn sự bình. Kính chúc quý đạo hữu một ngày nhẹ nhàng và đầy thiện duyên.'
];

/**
 * 12 mẫu lời cảm ơn và chúc phúc trang nghiêm, ấm áp khi có người bấm theo dõi (Follow) kênh
 */
export const FOLLOW_TEMPLATES = [
  'A Di Đà Phật! Tri ân đạo hữu {name} đã bấm theo dõi kênh Chùa Online. Kính chúc đạo hữu thân tâm thường an lạc, vạn sự hanh thông, phúc đức vô lượng.',
  'Hoan hỷ đón nhận duyên lành từ bạn {name} đã theo dõi kênh. Cầu chúc cho bạn cùng gia đình luôn được mười phương chư Phật gia hộ bình an, hạnh phúc.',
  'Cảm ơn bạn {name} đã phát tâm theo dõi đạo tràng. Nguyện ánh sáng từ bi luôn soi đường dẫn lối cho bạn trên mọi nẻo đường đời.',
  'A Di Đà Phật! Cảm tạ thiện hữu {name} đã kết duyên theo dõi kênh. Kính chúc bạn một đời an nhiên, tâm an vạn sự an, sở cầu như ý.',
  'Tri ân bạn {name} đã bấm theo dõi chốn thiền môn. Chúc bạn luôn dồi dào sức khỏe, công việc thuận lợi, gia đạo êm ấm cát tường.',
  'A Di Đà Phật! Đạo tràng vô cùng hoan hỷ khi bạn {name} gieo duyên theo dõi kênh. Cầu mong phước lành, may mắn và tài lộc luôn đồng hành cùng bạn.',
  'Kính tri ân công đức bạn {name} đã theo dõi kênh Chùa Online. Nguyện chúc cho bạn bồ đề tâm kiên cố, mọi âu lo phiền muộn đều hóa thành an yên.',
  'A Di Đà Phật! Cảm ơn người bạn thiện lành {name} đã theo dõi kênh. Chúc bạn mỗi ngày trôi qua đều ngập tràn niềm vui, an vui tự tại.',
  'Hoan hỷ chào đón bạn {name} đã theo dõi và đồng hành cùng kênh Chùa Online. Nguyện chúc cho bạn vạn dặm bình an, phúc lộc đủ đầy.',
  'A Di Đà Phật! Cảm ơn bạn {name} đã kết duyên theo dõi đạo tràng. Kính chúc bạn và người thân tai qua nạn khỏi, muôn việc cát tường hanh thông.',
  'Tri ân tấm lòng hướng Phật của bạn {name} qua nút theo dõi. Chúc bạn tâm luôn sáng suốt, gặp nhiều thiện duyên và quý nhân tương trợ.',
  'A Di Đà Phật! Cảm ơn bạn {name} đã theo dõi và đồng hành. Nguyện nguồn năng lượng từ bi và bình an lan tỏa sâu rộng trong cuộc sống của bạn.'
];

/**
 * 12 mẫu lời chúc mừng trang nghiêm, vang rền và đầy phước báu khi Đại Hồng Chung ngân vang (mỗi mốc 1.000 tim)
 */
export const BELL_TEMPLATES = [
  'Nam Mô A Di Đà Phật! Đạo tràng đã hoàn thành mốc {milestone} lượt tim công đức. Tiếng chuông Bát Nhã ngân vang rền khắp mười phương, xua tan muộn phiền, nguyện cầu quốc thái dân an, thiên hạ thái bình, chúng sinh an lạc!',
  'A Di Đà Phật! Đại Hồng Chung ngân vang rền mười phương pháp giới, chúc mừng mốc {milestone} lượt tim thành kính. Nguyện đem công đức này hồi hướng cho tất cả quý Phật tử thân tâm thường an lạc, phúc thọ tăng long, vạn sự hanh thông cát tường!',
  'Tiếng chuông thanh tịnh sớm hôm đánh thức bồ đề tâm! Tri ân muôn triệu tấm lòng đã chung tay thắp sáng mốc {milestone} lượt tim công đức. Nguyện cầu mười phương chư Phật từ bi gia hộ cho muôn nhà ấm no, tai qua nạn khỏi!',
  'Nam Mô Bổn Sư Thích Ca Mâu Ni Phật! Âm vang Đại Hồng Chung rung chuyển cõi ta bà, hoàn thành viên mãn {milestone} ngọn đèn tâm công đức. Chúc cho quý thiện hữu phước trí trang nghiêm, bồ đề tâm kiên cố, sở cầu tất ứng!',
  'A Di Đà Phật! Nghe tiếng chuông phiền não nhẹ, trí tuệ lớn bồ đề sinh. Chúc mừng đạo tràng đã viên thành mốc {milestone} lượt tim hướng Phật. Nguyện ánh sáng từ bi chiếu soi muôn nẻo, tiêu trừ tật bệnh chướng duyên!',
  'Hồng chung sơ khấu, bảo kệ cao tuyên! Tiếng chuông chùa ngân vang chúc mừng {milestone} lượt tim công đức viên mãn. Cầu chúc cho quý thiện nam tín nữ một đời bình an, gia đạo thuận hòa, con cháu thảo hiền hiển đạt!',
  'Nam Mô Quán Thế Âm Bồ Tát! Chuông chùa ngân nga xoa dịu mọi nỗi đau trần thế. Tri ân muôn pháp duyên lành đã vun đắp đủ {milestone} lượt tim thành tâm. Nguyện cầu hồng ân Tam Bảo che chở cho bạn và gia đình vạn dặm bình an!',
  'A Di Đà Phật! Phước báu vô lượng nơi cửa thiền linh thiêng. Hoan hỷ đại cát tường mốc {milestone} lượt tim cúng dường Tam Bảo. Nguyện cho công danh sự nghiệp của quý vị xuôi chèo mát mái, tài lộc dồi dào vững bền!',
  'Nam Mô A Di Đà Phật! Tiếng chuông vàng ngân rền thức tỉnh bao cõi lòng, chúc mừng mốc {milestone} lượt tim thành kính nơi Tam Bảo. Nguyện cho muôn nhà ấm no, người người gắn kết yêu thương, gia đạo an khang thịnh vượng!',
  'Văn chung thanh, phiền não khinh, trí tuệ trưởng, bồ đề sinh! Đại Hồng Chung ngân vang đón mừng mốc {milestone} lượt tim thiện lành. Nguyện phước lành Tam Bảo tuôn chảy vào đời bạn, vạn sự hanh thông như ý nguyện!',
  'Nam Mô Tiêu Tai Diên Thọ Dược Sư Phật! Tiếng chuông Bát Nhã ngân vang xua tan chướng nạn, hoàn thành mốc {milestone} lượt tim công đức. Cầu chúc cho quý vị thân không tật bệnh, tâm không phiền não, sống vui trọn vẹn từng ngày!',
  'A Di Đà Phật! Chuông chùa thức tỉnh giấc mộng trần gian, đón mừng mốc {milestone} lượt tim thành tâm chiêm bái. Kính chúc quý thiện hữu vạn dặm bình an, đi đâu cũng có quý nhân phù trợ, phước báu đủ đầy đời đời kiếp kiếp!'
];

/**
 * Trình quản lý lời nói AI với bộ nhớ xoay vòng chống lặp lại câu nói
 */
export class SpeechDirector {
  constructor() {
    this.recentWelcomeIndices = [];
    this.recentGiftIndices = new Map();
    this.recentAmbientIndices = [];
    this.recentFollowIndices = [];
    this.recentBellIndices = [];
  }

  /**
   * Chọn câu chào mừng ngẫu nhiên không lặp lại
   */
  getWelcomeSpeech(viewer = {}) {
    const v = viewer || {};
    const name = clean(v.nickname || v.username || 'thiện hữu', 80);
    const total = WELCOME_TEMPLATES.length;
    const historyLimit = Math.min(total - 1, 10);

    // Lọc các câu chưa dùng gần đây
    let candidateIndices = [];
    for (let i = 0; i < total; i++) {
      if (!this.recentWelcomeIndices.includes(i)) {
        candidateIndices.push(i);
      }
    }
    if (candidateIndices.length === 0) {
      candidateIndices = Array.from({ length: total }, (_, i) => i);
      this.recentWelcomeIndices = [];
    }

    const chosenIndex = candidateIndices[Math.floor(Math.random() * candidateIndices.length)];
    this.recentWelcomeIndices.push(chosenIndex);
    if (this.recentWelcomeIndices.length > historyLimit) {
      this.recentWelcomeIndices.shift();
    }

    const template = WELCOME_TEMPLATES[chosenIndex];
    const text = template
      .replaceAll('{name}', name)
      .replaceAll('{username}', v.username || name)
      .replaceAll('{nickname}', v.nickname || name);

    return {
      type: 'welcome',
      index: chosenIndex,
      text,
      name
    };
  }

  /**
   * Xác định danh mục quà tặng để chọn lời cảm ơn phù hợp nhất
   */
  detectGiftCategory(gift = {}) {
    const id = String(gift.id || gift.providerGiftId || '').toLowerCase();
    const name = String(gift.name || '').toLowerCase();
    const effect = String(gift.specialEffect || '').toLowerCase();

    // 1. Đại Lễ Chuông Chùa / Sư Tử
    if (id.includes('bell') || id.includes('lion') || name.includes('chuông') || name.includes('sư tử') || effect.includes('bell') || effect.includes('lion')) {
      return 'ceremony';
    }
    // 2. Cầu Sức Khỏe (Bó hoa mùa xuân, xuân, sức khỏe)
    if (name.includes('sức khỏe') || name.includes('mùa xuân') || name.includes('hoa xuân') || id.includes('spring') || id.includes('health')) {
      return 'health';
    }
    // 3. Cầu May Mắn / Gieo Quẻ (Yêu bạn, Cỏ bốn lá, Cỏ, Quẻ, Rất tốt, May mắn)
    if (name.includes('may mắn') || name.includes('cỏ') || name.includes('quẻ') || name.includes('yêu bạn') || name.includes('rất tốt') || id.includes('clover') || id.includes('love-you') || id.includes('good') || id.includes('luck')) {
      return 'luck';
    }
    // 4. Cầu Bình An (Bó hoa, Hoa sen, Sen, Bình an)
    if (name.includes('bình an') || name.includes('bó hoa') || id.includes('flower') || id.includes('lotus') || name.includes('sen') || id.includes('peace') || id.includes('bouquet')) {
      return 'peace';
    }
    // 5. Cầu Duyên, Tình Duyên (Hoa hồng, Bắn tim, Rose, Heart)
    if (name.includes('duyên') || name.includes('hồng') || name.includes('bắn tim') || id.includes('rose') || id.includes('heart') || id === 'love' || (id.includes('love') && !id.includes('clover') && !id.includes('love-you'))) {
      return 'love';
    }
    return 'general';
  }

  /**
   * Chọn lời cảm ơn dâng quà ngẫu nhiên theo danh mục và chống lặp
   */
  getGiftThankYouSpeech(sender = {}, gift = {}, repeatCount = 1) {
    const s = sender || {};
    const g = gift || {};
    const name = clean(s.nickname || s.username || 'thiện hữu', 80);
    let giftName = clean(g.name || 'món quà', 80);
    if (repeatCount > 1) {
      giftName = `${giftName} ×${repeatCount}`;
    }

    const category = this.detectGiftCategory(g);
    const templates = GIFT_TEMPLATES[category] || GIFT_TEMPLATES.general;
    const total = templates.length;
    const historyLimit = Math.min(total - 1, 4);

    if (!this.recentGiftIndices.has(category)) {
      this.recentGiftIndices.set(category, []);
    }
    const recent = this.recentGiftIndices.get(category);

    let candidates = [];
    for (let i = 0; i < total; i++) {
      if (!recent.includes(i)) candidates.push(i);
    }
    if (candidates.length === 0) {
      candidates = Array.from({ length: total }, (_, i) => i);
      recent.length = 0;
    }

    const chosenIndex = candidates[Math.floor(Math.random() * candidates.length)];
    recent.push(chosenIndex);
    if (recent.length > historyLimit) {
      recent.shift();
    }

    const template = templates[chosenIndex];
    const text = template
      .replaceAll('{name}', name)
      .replaceAll('{username}', s.username || name)
      .replaceAll('{nickname}', s.nickname || name)
      .replaceAll('{gift}', giftName);

    return {
      type: 'gift_thanks',
      category,
      index: chosenIndex,
      text,
      name,
      giftName
    };
  }

  /**
   * Chọn lời chúc an lạc định kỳ không lặp lại cho chế độ Treo Live 24/7
   */
  getAmbientSpeech() {
    const total = AMBIENT_TEMPLATES.length;
    const historyLimit = Math.min(total - 1, 6);

    let candidateIndices = [];
    for (let i = 0; i < total; i++) {
      if (!this.recentAmbientIndices.includes(i)) {
        candidateIndices.push(i);
      }
    }
    if (candidateIndices.length === 0) {
      candidateIndices = Array.from({ length: total }, (_, i) => i);
      this.recentAmbientIndices = [];
    }

    const chosenIndex = candidateIndices[Math.floor(Math.random() * candidateIndices.length)];
    this.recentAmbientIndices.push(chosenIndex);
    if (this.recentAmbientIndices.length > historyLimit) {
      this.recentAmbientIndices.shift();
    }

    return {
      type: 'ambient_blessing',
      index: chosenIndex,
      text: AMBIENT_TEMPLATES[chosenIndex]
    };
  }

  /**
   * Chọn lời cảm ơn và chúc phúc ngẫu nhiên khi có người follow kênh, chống lặp
   */
  getFollowSpeech(viewer = {}) {
    const v = viewer || {};
    const name = clean(v.nickname || v.username || 'thiện hữu', 80);
    const total = FOLLOW_TEMPLATES.length;
    const historyLimit = Math.min(total - 1, 6);

    let candidateIndices = [];
    for (let i = 0; i < total; i++) {
      if (!this.recentFollowIndices.includes(i)) {
        candidateIndices.push(i);
      }
    }
    if (candidateIndices.length === 0) {
      candidateIndices = Array.from({ length: total }, (_, i) => i);
      this.recentFollowIndices = [];
    }

    const chosenIndex = candidateIndices[Math.floor(Math.random() * candidateIndices.length)];
    this.recentFollowIndices.push(chosenIndex);
    if (this.recentFollowIndices.length > historyLimit) {
      this.recentFollowIndices.shift();
    }

    const template = FOLLOW_TEMPLATES[chosenIndex];
    const text = template
      .replaceAll('{name}', name)
      .replaceAll('{username}', v.username || name)
      .replaceAll('{nickname}', v.nickname || name);

    return {
      type: 'follow',
      index: chosenIndex,
      text,
      name
    };
  }

  /**
   * Chọn lời chúc mừng đại cát tường khi Đại Hồng Chung ngân vang mốc 1000 tim
   */
  getBellSpeech(milestoneLikes = 1000) {
    const formatted = Number(milestoneLikes || 1000).toLocaleString('vi-VN');
    const total = BELL_TEMPLATES.length;
    const historyLimit = Math.min(total - 1, 4);

    let candidateIndices = [];
    for (let i = 0; i < total; i++) {
      if (!this.recentBellIndices.includes(i)) {
        candidateIndices.push(i);
      }
    }
    if (candidateIndices.length === 0) {
      candidateIndices = Array.from({ length: total }, (_, i) => i);
      this.recentBellIndices = [];
    }

    const chosenIndex = candidateIndices[Math.floor(Math.random() * candidateIndices.length)];
    this.recentBellIndices.push(chosenIndex);
    if (this.recentBellIndices.length > historyLimit) {
      this.recentBellIndices.shift();
    }

    const template = BELL_TEMPLATES[chosenIndex];
    const text = template.replaceAll('{milestone}', formatted);

    return {
      type: 'bell_strike',
      index: chosenIndex,
      text,
      milestone: milestoneLikes
    };
  }
}

export const speechDirector = new SpeechDirector();
