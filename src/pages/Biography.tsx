import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Quote, BookOpen, History, ShieldCheck, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Biography: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-[#A19D96] hover:text-[#8B2323] transition-colors mb-8 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span className="text-sm font-bold uppercase tracking-widest">Quay lại</span>
      </button>

      <motion.article 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[40px] border border-[#E5E1D8] overflow-hidden shadow-sm"
      >
        {/* Header Section */}
        <div className="p-8 md:p-16 border-b border-[#E5E1D8] bg-[#FDFCF9] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#8B2323] opacity-[0.03] rounded-full -translate-y-1/2 translate-x-1/2" />
          
          <div className="relative z-10 text-center space-y-6">
            <span className="inline-block px-4 py-1 bg-[#8B2323]/10 text-[#8B2323] text-[10px] font-bold uppercase tracking-[0.2em] rounded-full">
              Phả Sử Dòng Họ
            </span>
            <h1 className="font-serif text-4xl md:text-5xl font-black text-[#2D2A26] leading-tight">
              Quá trình hình thành và phát triển <br />
              <span className="text-[#8B2323] italic">Chi họ Nguyễn Nhuận</span>
            </h1>
            <div className="flex items-center justify-center gap-4 text-[#A19D96]">
              <div className="h-px w-12 bg-[#E5E1D8]" />
              <Quote className="w-6 h-6 opacity-20" />
              <div className="h-px w-12 bg-[#E5E1D8]" />
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-8 md:p-16 space-y-12 text-[#4A4742] leading-relaxed">
          <section className="space-y-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <History className="w-5 h-5" />
              </div>
              <h2 className="font-serif text-2xl font-bold text-[#2D2A26]">Nguồn Gốc & Hình Thành</h2>
            </div>
            <p>
              Dòng họ Nguyễn Nhuận là một chi nhánh quan trọng của dòng họ Nguyễn Hữu, có nguồn gốc sâu xa từ vị thủy tổ Nguyễn Hữu Chỉ. Trải qua nhiều thế hệ, dòng họ đã không ngừng sinh sôi, nảy nở và phát triển mạnh mẽ tại các vùng đất trù phú, gắn liền với lịch sử khai hoang và lập nghiệp của cha ông.
            </p>
            <p>
              Quá trình hình thành của chi họ không chỉ là sự gia tăng về số lượng thành viên mà còn là sự bồi đắp về các giá trị văn hóa, tinh thần. Mỗi thế hệ đi trước đều để lại những dấu ấn đậm nét về lòng yêu nước, tinh thần hiếu học và sự cần cù trong lao động.
            </p>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h2 className="font-serif text-2xl font-bold text-[#2D2A26]">Phát Triển Hậu Duệ & Sự Nghiệp</h2>
            </div>
            <p>
              Sự phát triển của hậu duệ chi họ Nguyễn Nhuận được minh chứng qua sự thành đạt của nhiều cá nhân trong các lĩnh vực khác nhau từ giáo dục, kinh tế đến chính trị. Con cháu dòng họ luôn giữ vững truyền thống hiếu học, nhiều người đã đỗ đạt cao và đóng góp đáng kể cho sự phát triển của quê hương, đất nước.
            </p>
            <p>
              Tinh thần tự lực tự cường và ý chí vươn lên đã trở thành "gen" quý báu được truyền thừa qua các đời. Dù ở bất cứ đâu, người họ Nguyễn Nhuận vẫn luôn giữ được bản sắc và lòng tự hào về dòng tộc.
            </p>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-[#8B2323]">
                <BookOpen className="w-5 h-5" />
              </div>
              <h2 className="font-serif text-2xl font-bold text-[#2D2A26]">Bảo Tồn Di Sản & Tâm Linh</h2>
            </div>
            <p>
              Việc tôn tạo lăng mộ và nhà thờ tổ tiên luôn được hội đồng chi tộc đặt lên hàng đầu. Đây không chỉ là nơi thờ cúng mà còn là biểu tượng của sự đoàn kết và lòng tri ân đối với các bậc tiền nhân. Các công trình tâm linh của dòng họ thường xuyên được tu bổ, khánh thành trang nghiêm, tạo không gian ấm cúng để con cháu hội tụ trong các dịp lễ tết, giỗ chạp.
            </p>
            <p>
              Nơi an táng của các vị thủy tổ và tiên tổ được chăm sóc chu đáo, thể hiện đạo lý "Uống nước nhớ nguồn" sâu sắc của dòng họ Nguyễn Nhuận.
            </p>
          </section>

          <div className="bg-[#FDFCF9] border border-[#E5E1D8] rounded-3xl p-8 md:p-12 relative overflow-hidden">
            <Heart className="absolute -bottom-4 -right-4 w-32 h-32 text-[#8B2323] opacity-[0.03]" />
            <div className="relative z-10 space-y-6">
              <h3 className="font-serif text-2xl font-bold text-[#8B2323] italic">Lời nhắn nhủ đến hậu thế</h3>
              <p className="text-lg italic font-serif leading-relaxed text-[#6B665F]">
                "Qua việc bảo tồn và phát triển chi họ Nguyễn Nhuận, hội đồng chi tộc Nguyễn Nhuận nhắn nhủ đến thế hệ trẻ hãy luôn nhớ về cội nguồn, trân trọng và tôn kính tổ tiên. Đồng thời, cần nỗ lực học tập, rèn luyện bản thân để xứng đáng với những gì mà các bậc tiền nhân đã gây dựng và truyền lại. Sự đoàn kết, yêu thương và tinh thần tương trợ lẫn nhau sẽ là nền tảng vững chắc để mỗi người vươn lên, xây dựng một cộng đồng ngày càng vững mạnh và phát triển."
              </p>
              <div className="pt-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#8B2323] flex items-center justify-center text-white font-serif text-xl">
                  阮
                </div>
                <div>
                  <div className="text-sm font-bold text-[#2D2A26]">Hội Đồng Chi Tộc</div>
                  <div className="text-xs text-[#A19D96] uppercase tracking-widest">Nguyễn Nhuận</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Section */}
        <div className="p-8 bg-[#FDFCF9] border-t border-[#E5E1D8] text-center">
          <p className="text-xs text-[#A19D96] uppercase tracking-[0.3em]">
            Lưu giữ bởi Hệ thống Quản lý Gia phả Nguyễn Nhuận &copy; 2024
          </p>
        </div>
      </motion.article>
    </div>
  );
};

export default Biography;
