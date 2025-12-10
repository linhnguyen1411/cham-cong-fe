import React, { useEffect, useState } from 'react';
import { Lightbulb, Zap } from 'lucide-react';

export const MotivationQuote: React.FC = () => {
  const quotes = [
    // Tiếng Việt
    { text: "Thời gian là vàng bạc. Hãy sử dụng nó một cách khôn ngoan.", author: "Tục ngữ" },
    { text: "Mỗi ngày là một cơ hội mới để trở nên tốt hơn.", author: "Lời khuyên" },
    { text: "Công việc chăm chỉ hôm nay sẽ dẫn đến thành công ngày mai.", author: "Tục ngữ" },
    { text: "Kiên nhẫn là chìa khóa thành công. Hãy tiếp tục cố gắng.", author: "Lời khuyên" },
    { text: "Không có gì là không thể nếu bạn có quyết tâm.", author: "Lời khuyên" },
    { text: "Hãy đặt mục tiêu cao và làm việc không ngừng để đạt được nó.", author: "Lời khuyên" },
    { text: "Bạn có khả năng làm được những điều tuyệt vời, hãy tin tưởng vào bản thân.", author: "Lời khuyên" },
    { text: "Mỗi bước nhỏ đều đưa bạn gần hơn đến đích.", author: "Lời khuyên" },
    { text: "Đừng sợ thất bại, vì nó là bước đệm của thành công.", author: "Lời khuyên" },
    { text: "Hôm nay hãy làm tốt nhất của mình, ngày mai sẽ tốt hơn.", author: "Lời khuyên" },
    { text: "Thành công không phải xảy ra qua đêm, mà là kết quả của nỗ lực liên tục.", author: "Lời khuyên" },
    { text: "Hãy nhớ rằng bạn đang làm việc không chỉ cho bản thân mà còn cho tương lai.", author: "Lời khuyên" },
    { text: "Mỗi thách thức là một cơ hội để phát triển và trưởng thành.", author: "Lời khuyên" },
    { text: "Đừng bao giờ từ bỏ ước mơ của bạn, vì nó xứng đáng.", author: "Lời khuyên" },
    { text: "Sự chăm chỉ và kiên trì là chìa khóa mở cửa thành công.", author: "Lời khuyên" },
    { text: "Bạn có thể, bạn sẽ, bạn nhất định sẽ thành công!", author: "Lời khuyên" },
    { text: "Hãy yêu thích công việc của bạn, rồi bạn sẽ không bao giờ làm việc một ngày nào cả.", author: "Lời khuyên" },
    { text: "Tài năng là quý hiếm, nhưng sự chăm chỉ còn quý hiếm hơn.", author: "Lời khuyên" },
    { text: "Hôm nay là quá khứ, ngày mai là tương lai. Hãy tập trung vào hiện tại!", author: "Lời khuyên" },

    // Tiếng Anh
    { text: "Time is gold. Use it wisely.", author: "Proverb" },
    { text: "Success is not final, failure is not fatal.", author: "Winston Churchill" },
    { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
    { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
    { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
    { text: "Hard work beats talent when talent isn't working hard.", author: "Tim Notke" },
    { text: "Your limitation only exists in your mind.", author: "Unknown" },
    { text: "Every accomplishment starts with the decision to try.", author: "John F. Kennedy" },
    { text: "Excellence is not a destination; it is a continuous journey.", author: "Brian Tracy" },
    { text: "The greatest glory in living lies not in never falling, but in rising every time we fall.", author: "Nelson Mandela" },
    { text: "Success is the result of preparation, hard work, and learning from failure.", author: "Colin Powell" },
    { text: "Do something today that your future self will thank you for.", author: "Sean Patrick Flanery" },
    { text: "Quality is not an act, it is a habit.", author: "Aristotle" },
    { text: "Motivation is what gets you started. Habit is what keeps you going.", author: "Jim Ryun" },
    { text: "Your work is going to fill a large part of your life. Make it count.", author: "Steve Jobs" },
    { text: "The only impossible journey is the one you never begin.", author: "Tony Robbins" },
    { text: "Progress, not perfection.", author: "Unknown" },
    { text: "Every expert was once a beginner.", author: "Unknown" },
    { text: "You are capable of amazing things.", author: "Unknown" },
  ];

  const colorSchemes = [
    { 
      bg: 'bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700',
      accent: 'from-blue-400 to-cyan-400',
      textColor: 'text-white',
      icon: 'text-blue-100'
    },
    { 
      bg: 'bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-700',
      accent: 'from-purple-400 to-pink-400',
      textColor: 'text-white',
      icon: 'text-purple-100'
    },
    { 
      bg: 'bg-gradient-to-br from-orange-500 via-orange-600 to-red-700',
      accent: 'from-orange-400 to-red-400',
      textColor: 'text-white',
      icon: 'text-orange-100'
    },
    { 
      bg: 'bg-gradient-to-br from-green-500 via-emerald-600 to-teal-700',
      accent: 'from-green-400 to-teal-400',
      textColor: 'text-white',
      icon: 'text-green-100'
    },
    { 
      bg: 'bg-gradient-to-br from-pink-500 via-pink-600 to-rose-700',
      accent: 'from-pink-400 to-rose-400',
      textColor: 'text-white',
      icon: 'text-pink-100'
    },
    { 
      bg: 'bg-gradient-to-br from-indigo-500 via-indigo-600 to-blue-700',
      accent: 'from-indigo-400 to-blue-400',
      textColor: 'text-white',
      icon: 'text-indigo-100'
    },
    { 
      bg: 'bg-gradient-to-br from-amber-500 via-amber-600 to-orange-700',
      accent: 'from-amber-400 to-orange-400',
      textColor: 'text-white',
      icon: 'text-amber-100'
    },
    { 
      bg: 'bg-gradient-to-br from-cyan-500 via-cyan-600 to-blue-700',
      accent: 'from-cyan-400 to-blue-400',
      textColor: 'text-white',
      icon: 'text-cyan-100'
    },
  ];

  const [quote, setQuote] = useState(quotes[0]);
  const [color, setColor] = useState(colorSchemes[0]);

  useEffect(() => {
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    const randomColor = colorSchemes[Math.floor(Math.random() * colorSchemes.length)];
    setQuote(randomQuote);
    setColor(randomColor);
  }, []);

  return (
    <div className={`relative overflow-hidden rounded-2xl shadow-xl transition-all duration-500 hover:shadow-2xl hover:scale-[1.02] ${color.bg} p-8 md:p-10`}>
      {/* Decorative blobs */}
      <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-white opacity-10 blur-3xl"></div>
      <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-white opacity-10 blur-3xl"></div>

      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-start gap-4 md:gap-5">
          {/* Icon */}
          <div className={`flex-shrink-0 p-3 rounded-xl bg-white bg-opacity-20 backdrop-blur-md ${color.icon}`}>
            <Lightbulb size={28} />
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0">
            {/* Quote */}
            <p className={`${color.textColor} text-lg md:text-xl font-bold leading-relaxed italic mb-4 tracking-tight`}>
              "{quote.text}"
            </p>

            {/* Author */}
            <div className="flex items-center gap-2">
              <Zap size={16} className={`${color.icon} flex-shrink-0`} />
              <p className={`${color.textColor} text-sm font-medium opacity-90`}>
                {quote.author}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom accent line */}
        <div className={`mt-6 h-1 w-12 rounded-full bg-gradient-to-r ${color.accent} opacity-60`}></div>
      </div>
    </div>
  );
};
