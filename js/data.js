/* Demo data for Greenwich Wishes. Replace GW_DATA.wishes with your API/database output. */
(function () {
    var CONTINENTS = {
        asia: { vi: 'Châu Á', en: 'Asia' },
        europe: { vi: 'Châu Âu', en: 'Europe' },
        america: { vi: 'Châu Mỹ', en: 'Americas' },
        oceania: { vi: 'Châu Đại Dương', en: 'Oceania' },
        africa: { vi: 'Châu Phi', en: 'Africa' }
    };

    // code: [vi, en, continent, centerLat, centerLng, weight, cities[[name, lat, lng], ...]]
    var COUNTRIES = {
        VN: ['Việt Nam', 'Vietnam', 'asia', 16.0, 106.0, 70, [
            ['Hà Nội', 21.03, 105.78], ['TP. Hồ Chí Minh', 10.80, 106.65], ['Đà Nẵng', 16.05, 108.24], ['Cần Thơ', 10.03, 105.77],
            ['Hải Phòng', 20.84, 106.69], ['Huế', 16.46, 107.59], ['Nha Trang', 12.24, 109.19], ['Đà Lạt', 11.94, 108.44],
            ['Vinh', 18.68, 105.68], ['Quy Nhơn', 13.78, 109.22], ['Buôn Ma Thuột', 12.67, 108.04], ['Biên Hòa', 10.95, 106.82],
            ['Vũng Tàu', 10.35, 107.08], ['Thái Nguyên', 21.59, 105.84], ['Hạ Long', 20.95, 107.08], ['Cà Mau', 9.18, 105.15]]],
        GB: ['Vương quốc Anh', 'United Kingdom', 'europe', 54.0, -2.0, 22, [
            ['London', 51.48, 0.0], ['Manchester', 53.48, -2.24], ['Birmingham', 52.49, -1.89], ['Edinburgh', 55.95, -3.19],
            ['Glasgow', 55.86, -4.25], ['Bristol', 51.45, -2.59], ['Leeds', 53.80, -1.55], ['Cardiff', 51.48, -3.18]]],
        US: ['Hoa Kỳ', 'United States', 'america', 39.8, -98.6, 10, [
            ['New York', 40.71, -74.0], ['San Francisco', 37.77, -122.42], ['Los Angeles', 34.05, -118.24], ['Houston', 29.76, -95.37],
            ['Seattle', 47.6, -122.33], ['Boston', 42.36, -71.06], ['Chicago', 41.88, -87.63], ['Atlanta', 33.75, -84.39]]],
        AU: ['Úc', 'Australia', 'oceania', -25.3, 133.8, 9, [
            ['Sydney', -33.87, 151.2], ['Melbourne', -37.81, 144.96], ['Brisbane', -27.47, 153.02], ['Perth', -31.95, 115.86], ['Adelaide', -34.93, 138.6]]],
        JP: ['Nhật Bản', 'Japan', 'asia', 36.2, 138.3, 7, [['Tokyo', 35.68, 139.69], ['Osaka', 34.69, 135.5], ['Fukuoka', 33.59, 130.4], ['Sapporo', 43.06, 141.35]]],
        KR: ['Hàn Quốc', 'South Korea', 'asia', 36.5, 127.9, 6, [['Seoul', 37.57, 126.98], ['Busan', 35.18, 129.08]]],
        SG: ['Singapore', 'Singapore', 'asia', 1.35, 103.82, 5, [['Singapore', 1.35, 103.82]]],
        DE: ['Đức', 'Germany', 'europe', 51.2, 10.4, 5, [['Berlin', 52.52, 13.4], ['Munich', 48.14, 11.58], ['Hamburg', 53.55, 9.99]]],
        FR: ['Pháp', 'France', 'europe', 46.6, 2.2, 4, [['Paris', 48.86, 2.35], ['Lyon', 45.76, 4.84], ['Toulouse', 43.6, 1.44]]],
        NL: ['Hà Lan', 'Netherlands', 'europe', 52.1, 5.3, 3, [['Amsterdam', 52.37, 4.9], ['Rotterdam', 51.92, 4.48]]],
        CA: ['Canada', 'Canada', 'america', 56.1, -106.3, 5, [['Toronto', 43.65, -79.38], ['Vancouver', 49.28, -123.12], ['Montreal', 45.5, -73.57]]],
        NZ: ['New Zealand', 'New Zealand', 'oceania', -40.9, 174.9, 3, [['Auckland', -36.85, 174.76], ['Wellington', -41.29, 174.78]]],
        TH: ['Thái Lan', 'Thailand', 'asia', 15.9, 100.99, 4, [['Bangkok', 13.76, 100.5], ['Chiang Mai', 18.79, 98.98]]],
        MY: ['Malaysia', 'Malaysia', 'asia', 4.2, 101.98, 3, [['Kuala Lumpur', 3.14, 101.69], ['Penang', 5.41, 100.33]]],
        CN: ['Trung Quốc', 'China', 'asia', 35.9, 104.2, 5, [['Shanghai', 31.23, 121.47], ['Beijing', 39.9, 116.4], ['Shenzhen', 22.54, 114.06], ['Chengdu', 30.57, 104.07]]],
        IN: ['Ấn Độ', 'India', 'asia', 20.6, 78.96, 4, [['Mumbai', 19.08, 72.88], ['Delhi', 28.61, 77.21], ['Bangalore', 12.97, 77.59]]],
        PH: ['Philippines', 'Philippines', 'asia', 12.9, 121.8, 2, [['Manila', 14.6, 120.98], ['Cebu', 10.32, 123.89]]],
        ID: ['Indonesia', 'Indonesia', 'asia', -0.8, 113.9, 3, [['Jakarta', -6.21, 106.85], ['Bali', -8.65, 115.22]]],
        TW: ['Đài Loan', 'Taiwan', 'asia', 23.7, 121.0, 2, [['Taipei', 25.03, 121.57]]],
        KH: ['Campuchia', 'Cambodia', 'asia', 12.6, 104.99, 2, [['Phnom Penh', 11.56, 104.92]]],
        LA: ['Lào', 'Laos', 'asia', 19.9, 102.5, 1, [['Vientiane', 17.97, 102.63]]],
        AE: ['UAE', 'United Arab Emirates', 'asia', 23.4, 53.8, 2, [['Dubai', 25.2, 55.27], ['Abu Dhabi', 24.45, 54.38]]],
        IE: ['Ireland', 'Ireland', 'europe', 53.4, -8.2, 2, [['Dublin', 53.35, -6.26]]],
        FI: ['Phần Lan', 'Finland', 'europe', 61.9, 25.7, 1, [['Helsinki', 60.17, 24.94]]],
        SE: ['Thụy Điển', 'Sweden', 'europe', 60.1, 18.6, 1, [['Stockholm', 59.33, 18.07]]],
        CH: ['Thụy Sĩ', 'Switzerland', 'europe', 46.8, 8.2, 1, [['Zurich', 47.38, 8.54]]],
        ES: ['Tây Ban Nha', 'Spain', 'europe', 40.5, -3.7, 2, [['Madrid', 40.42, -3.7], ['Barcelona', 41.39, 2.17]]],
        IT: ['Ý', 'Italy', 'europe', 41.9, 12.6, 2, [['Rome', 41.9, 12.5], ['Milan', 45.46, 9.19]]],
        PL: ['Ba Lan', 'Poland', 'europe', 51.9, 19.1, 1, [['Warsaw', 52.23, 21.01]]],
        TR: ['Thổ Nhĩ Kỳ', 'Türkiye', 'europe', 38.9, 35.2, 1, [['Istanbul', 41.01, 28.98]]],
        MX: ['Mexico', 'Mexico', 'america', 23.6, -102.6, 1, [['Mexico City', 19.43, -99.13]]],
        BR: ['Brazil', 'Brazil', 'america', -14.2, -51.9, 2, [['São Paulo', -23.55, -46.63], ['Rio de Janeiro', -22.91, -43.17]]],
        AR: ['Argentina', 'Argentina', 'america', -38.4, -63.6, 1, [['Buenos Aires', -34.6, -58.38]]],
        ZA: ['Nam Phi', 'South Africa', 'africa', -30.6, 22.9, 2, [['Johannesburg', -26.2, 28.05], ['Cape Town', -33.92, 18.42]]],
        NG: ['Nigeria', 'Nigeria', 'africa', 9.1, 8.7, 1, [['Lagos', 6.52, 3.38], ['Abuja', 9.07, 7.4]]],
        EG: ['Ai Cập', 'Egypt', 'africa', 26.8, 30.8, 1, [['Cairo', 30.04, 31.24]]],
        KE: ['Kenya', 'Kenya', 'africa', -0.02, 37.9, 1, [['Nairobi', -1.29, 36.82]]]
    };

    var CAMPUSES = {
        hn: { lat: 21.0367, lng: 105.7826 },
        dn: { lat: 16.0544, lng: 108.2420 },
        hcm: { lat: 10.8017, lng: 106.6500 },
        ct: { lat: 10.0341, lng: 105.7700 },
        uk: { lat: 51.4826, lng: -0.0077 },
        global: null
    };

    var MSGS = {
        vi: [
            'Chúc Greenwich Việt Nam ngày càng vươn xa, là cây cầu đưa thật nhiều thế hệ sinh viên ra thế giới!',
            'Cảm ơn thầy cô đã luôn kiên nhẫn đồng hành cùng chúng em qua từng assignment. Chúc thầy cô thật nhiều sức khỏe!',
            'Mong rằng mình sẽ tốt nghiệp loại First Class và được sang London dự lễ tốt nghiệp cùng bạn bè.',
            'Chúc các bạn tân sinh viên luôn giữ lửa đam mê, dám thử, dám sai và dám bước ra khỏi vùng an toàn.',
            'Bốn năm ở Greenwich là quãng thời gian đẹp nhất. Chúc trường mãi là ngôi nhà thứ hai của sinh viên.',
            'Chúc con gái học thật giỏi, tự tin và luôn hạnh phúc trên hành trình trở thành công dân toàn cầu.',
            'Mong Greenwich tiếp tục kết nối thêm nhiều doanh nghiệp để sinh viên có cơ hội thực tập thật chất lượng.',
            'Chúc cộng đồng Greenwich luôn đoàn kết, sáng tạo và lan tỏa giá trị tích cực đến xã hội.',
            'Hẹn gặp lại các bạn K19 trong ngày hội cựu sinh viên! Chúc mọi người thành công rực rỡ.',
            'Ước mơ của mình là khởi nghiệp một startup công nghệ giúp ích cho nông dân miền Tây.',
            'Chúc các câu lạc bộ ở Greenwich ngày càng sôi động và gắn kết sinh viên bốn cơ sở.',
            'Cảm ơn Greenwich đã cho mình tấm bằng Anh Quốc ngay tại Việt Nam. Chúc trường luôn phát triển bền vững!',
            'Chúc mùa thi này mọi người đều qua môn, deadline nào cũng kịp và không ai phải thức trắng đêm.',
            'Mong rằng sinh viên Greenwich sẽ luôn tự tin sử dụng tiếng Anh và bản lĩnh trên mọi đấu trường quốc tế.'
        ],
        en: [
            'Wishing Greenwich Vietnam a bright future, a bridge that carries generations of students to the world!',
            'Thank you to all my lecturers for your patience through every assignment. Wishing you good health and joy!',
            'My dream is to graduate with First Class Honours and celebrate in London with my friends.',
            'To all freshers: keep your passion alive, be brave, make mistakes and step outside your comfort zone.',
            'Four years at Greenwich were the best years of my life. May it always be a second home for students.',
            'So proud of the global community we are building together. Greetings from abroad!',
            'Wishing every Greenwich graduate the courage to chase big ideas and the kindness to lift others up.',
            'It was a privilege to teach such curious, creative students. Keep learning, and keep asking why!',
            'Best wishes from our partner company. We look forward to welcoming more Greenwich interns next year.',
            'May our friendship between Vietnam and the UK grow stronger with every new cohort.',
            'Hoping to see more research collaborations between our campuses. The future is bright!',
            'Good luck in your exams, everyone. You have got this!'
        ]
    };

    var NAMES_VN = ['Nguyễn Minh Anh', 'Trần Gia Huy', 'Lê Thảo Vy', 'Phạm Đức Long', 'Hoàng Bảo Ngọc', 'Vũ Quang Khải',
        'Đặng Thu Hà', 'Bùi Tuấn Kiệt', 'Đỗ Khánh Linh', 'Ngô Hải Đăng', 'Dương Mỹ Tâm', 'Lý Hoàng Nam', 'Phan Ngọc Hân',
        'Huỳnh Tấn Phát', 'Võ Thanh Trúc', 'Trịnh Nhật Minh', 'Mai Phương Thảo', 'Cao Văn Hiếu', 'Tô Bích Ngân', 'Lâm Gia Bảo'];
    var NAMES_INT = ['Oliver Bennett', 'Emily Clarke', 'James Turner', 'Sophie Williams', 'Daniel Kim', 'Yuki Tanaka',
        'Lucas Müller', 'Chloé Martin', 'Liam O\'Connor', 'Aisha Rahman', 'Mateo Silva', 'Priya Sharma', 'Noah Jensen',
        'Grace Wong', 'Ethan Brooks', 'Mia Laurent'];

    var ROLES = ['student', 'student', 'student', 'alumni', 'alumni', 'staff', 'parent', 'partner'];
    var VN_CAMPUSES = ['hn', 'hn', 'hcm', 'hcm', 'dn', 'ct'];
    var THEMES = ['p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'p07', 'p08', 'p09', 'p10', 'p11', 'p12', 'p13'];

    // deterministic PRNG so the demo looks the same on every load
    var seed = 20091;
    function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }

    var countryPool = [];
    Object.keys(COUNTRIES).forEach(function (c) { for (var i = 0; i < COUNTRIES[c][5]; i++) countryPool.push(c); });

    var wishes = [];
    var start = new Date('2026-10-26T20:00:00').getTime();
    for (var i = 0; i < 66; i++) {
        var country = pick(countryPool);
        var isVN = country === 'VN';
        var city = pick(COUNTRIES[country][6]);
        var campus = isVN ? pick(VN_CAMPUSES) : (country === 'GB' ? 'uk' : (rand() < .5 ? pick(VN_CAMPUSES) : 'global'));
        var lang = isVN ? (rand() < .8 ? 'vi' : 'en') : 'en';
        wishes.push({
            id: 'w' + (1000 + i),
            name: isVN || rand() < .45 ? pick(NAMES_VN) : pick(NAMES_INT),
            role: pick(ROLES),
            campus: campus,
            country: country,
            city: city[0],
            message: pick(MSGS[lang]),
            theme: THEMES[(i * 5) % THEMES.length],
            hearts: Math.floor(rand() * rand() * 240),
            createdAt: new Date(start - Math.floor(i * 3.3 * 3600 * 1000 + rand() * 3600 * 1000)).toISOString()
        });
    }

    window.GW_DATA = {
        continents: CONTINENTS,
        countries: COUNTRIES,
        campuses: CAMPUSES,
        themes: THEMES,
        wishes: wishes,
        home: { lat: 21.0367, lng: 105.7826 } // Greenwich Vietnam (Hanoi campus)
    };
})();
