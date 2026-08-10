import { GrammarTopic } from '@/types';

export const GRAMMAR_TOPICS: GrammarTopic[] = [
  {
    id: 'tenses-workplace',
    titleVi: 'Thì trong công việc (Workplace Tenses)',
    descriptionVi: 'Phân biệt Quá khứ đơn (Past Simple) & Hiện tại hoàn thành (Present Perfect) khi viết email, báo cáo tiến độ.',
    level: 'B1 - B2',
    questions: [
      {
        id: 't1',
        category: 'tenses-workplace',
        title: 'Báo cáo công việc đã hoàn thành',
        prompt: 'Chọn dạng đúng của động từ để điền vào câu báo cáo tiến độ dự án:',
        sentenceWithBlank: 'We ____ the backend deployment yesterday, but we ____ the load testing yet.',
        options: [
          'completed / have not finished',
          'have completed / didn\'t finish',
          'completed / didn\'t finish',
          'have completed / have not finished'
        ],
        correctIndex: 0,
        explanationVi: 'Dùng Past Simple ("completed") vì có mốc thời gian xác định "yesterday". Dùng Present Perfect ("have not finished") đi với "yet" chỉ hành động chưa hoàn thành tính tới hiện tại.',
        ruleSummary: 'Past Simple = mốc thời gian rõ ràng (yesterday, last week). Present Perfect = liên quan tới hiện tại, có "yet/already/since".'
      },
      {
        id: 't2',
        category: 'tenses-workplace',
        title: 'Kinh nghiệm làm việc',
        prompt: 'Điền thì đúng vào câu trả lời phỏng vấn xin việc:',
        sentenceWithBlank: 'I ____ as a product manager for 5 years before I moved to London.',
        options: [
          'worked',
          'have worked',
          'had worked',
          'was working'
        ],
        correctIndex: 2,
        explanationVi: 'Dùng Past Perfect ("had worked") vì hành động làm PM đã hoàn thành TRƯỚC một mốc thời gian khác trong quá khứ ("before I moved to London").',
        ruleSummary: 'Past Perfect (Had + V3) diễn tả hành động xảy ra và kết thúc trước một mốc quá khứ khác.'
      },
      {
        id: 't3',
        category: 'tenses-workplace',
        title: 'Cập nhật tình hình hiện tại',
        prompt: 'Chọn câu đúng nhất khi cập nhật cho khách hàng:',
        sentenceWithBlank: 'The server ____ active since 8 AM and no errors ____ so far.',
        options: [
          'was / were reported',
          'has been / have been reported',
          'is / reported',
          'had been / had reported'
        ],
        correctIndex: 1,
        explanationVi: 'Dùng Present Perfect với "since 8 AM" và "so far" (tính tới thời điểm này). Cần dạng bị động "have been reported".',
        ruleSummary: 'Since/So far đi với Hiện tại hoàn thành (Present Perfect).'
      }
    ]
  },
  {
    id: 'conditionals-proposals',
    titleVi: 'Câu điều kiện & Đề xuất (Conditionals)',
    descriptionVi: 'Dùng câu điều kiện loại 1, 2, 3 để thương lượng giá, đàm phán hợp đồng và đề xuất giải pháp.',
    level: 'B2 - C1',
    questions: [
      {
        id: 'c1',
        category: 'conditionals-proposals',
        title: 'Đàm phán hợp đồng (Điều kiện loại 2)',
        prompt: 'Chọn đáp án lịch sự và giả định cho cuộc đàm phán:',
        sentenceWithBlank: 'If your team ____ the deadline to Friday, we ____ willing to offer a 5% discount.',
        options: [
          'extended / would be',
          'extends / will be',
          'had extended / would have been',
          'would extend / are'
        ],
        correctIndex: 0,
        explanationVi: 'Câu điều kiện loại 2 (If + Past Simple, S + would + V-bare) dùng cho tình huống giả định lịch sự hoặc khó xảy ra ở hiện tại/tương lai.',
        ruleSummary: 'Conditional Type 2: Mệnh đề If dùng Past Simple, mệnh đề chính dùng Would/Could + V-bare.'
      },
      {
        id: 'c2',
        category: 'conditionals-proposals',
        title: 'Nhìn lại sự cố đã qua (Điều kiện loại 3)',
        prompt: 'Nhận xét về một lỗi hỏng hóc quá khứ trong buổi Post-mortem:',
        sentenceWithBlank: 'If we ____ the database backups regularly, we ____ so much user data last week.',
        options: [
          'verified / wouldn\'t lose',
          'had verified / wouldn\'t have lost',
          'have verified / didn\'t lose',
          'would verify / hadn\'t lost'
        ],
        correctIndex: 1,
        explanationVi: 'Câu điều kiện loại 3 (If + Had V3, S + would have V3) diễn tả tiếc nuối/giả định trái ngược hoàn toàn với thực tế trong quá khứ.',
        ruleSummary: 'Conditional Type 3: Trái ngược với thực tế quá khứ (If had + V3, would have + V3).'
      }
    ]
  },
  {
    id: 'modals-polite',
    titleVi: 'Động từ khuyết thiếu & Lịch sự (Polite Modals)',
    descriptionVi: 'Cách giao tiếp tinh tế trong email công việc: Could, Would, Should, Might, Need to.',
    level: 'B1 - B2',
    questions: [
      {
        id: 'm1',
        category: 'modals-polite',
        title: 'Yêu cầu đồng nghiệp xem lại tài liệu',
        prompt: 'Chọn cách diễn đạt lịch sự chuyên nghiệp nhất trong email:',
        sentenceWithBlank: '____ you mind checking the attached invoice when you have a moment?',
        options: [
          'Would',
          'Could',
          'Should',
          'Do'
        ],
        correctIndex: 0,
        explanationVi: 'Cấu trúc "Would you mind + V-ing...?" là mẫu câu yêu cầu cực kỳ lịch sự trong tiếng Anh công sở.',
        ruleSummary: 'Would you mind + V-ing...? = Bạn có phiền... không?'
      },
      {
        id: 'm2',
        category: 'modals-polite',
        title: 'Đề xuất nhẹ nhàng',
        prompt: 'Chọn câu đề xuất khéo léo cho sếp:',
        sentenceWithBlank: 'It ____ be advisable to delay the release until we fix the critical bug.',
        options: [
          'must',
          'might',
          'should have',
          'has to'
        ],
        correctIndex: 1,
        explanationVi: 'Dùng "might be advisable" để đưa ra lời khuyên mềm mỏng, không ra lệnh hay áp đặt đối phương.',
        ruleSummary: 'Might / Could giúp làm giảm tính áp đặt trong các lời khuyên chuyên nghiệp.'
      }
    ]
  },
  {
    id: 'relative-clauses',
    titleVi: 'Mệnh đề quan hệ & Rút gọn (Relative Clauses)',
    descriptionVi: 'Viết câu phức ngắn gọn, súc tích trong báo cáo kĩ thuật và tài liệu sản phẩm.',
    level: 'B2 - C1',
    questions: [
      {
        id: 'r1',
        category: 'relative-clauses',
        title: 'Mệnh đề quan hệ rút gọn chủ động',
        prompt: 'Rút gọn mệnh đề quan hệ trong câu kĩ thuật:',
        sentenceWithBlank: 'The new feature ____ user engagement was designed by our design lead.',
        options: [
          'targeting',
          'which target',
          'targeted',
          'to target'
        ],
        correctIndex: 0,
        explanationVi: 'Mệnh đề chủ động "which targets user engagement" rút gọn bằng cách bỏ "which" và chuyển động từ sang V-ing ("targeting").',
        ruleSummary: 'Rút gọn MĐQH chủ động -> V-ing. Rút gọn MĐQH bị động -> V3/ed.'
      },
      {
        id: 'r2',
        category: 'relative-clauses',
        title: 'Mệnh đề quan hệ rút gọn bị động',
        prompt: 'Rút gọn mệnh đề quan hệ bị động:',
        sentenceWithBlank: 'The servers ____ in the cloud backup are monitored 24/7.',
        options: [
          'deploying',
          'deployed',
          'which deployed',
          'are deployed'
        ],
        correctIndex: 1,
        explanationVi: 'Gốc câu: "...servers which are deployed in the cloud". Rút gọn bị động bỏ đại từ quan hệ và tobe, giữ lại V3 ("deployed").',
        ruleSummary: 'Mệnh đề bị động rút gọn còn Quá khứ phân tử (V3/ed).'
      }
    ]
  }
];
