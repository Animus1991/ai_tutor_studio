const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const target = `<div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <div>
                        <h4 className="text-xs font-medium text-slate-900 dark:text-white">{activity.title}</h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{activity.time}</p>
                      </div>
                    </div>`;

const replacement = `<div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
                        {activity.icon === 'Brain' && <Brain className="w-4 h-4" />}
                        {activity.icon === 'Users' && <Users className="w-4 h-4" />}
                        {activity.icon === 'Upload' && <Upload className="w-4 h-4" />}
                        {activity.icon === 'CheckCircle2' && <CheckCircle2 className="w-4 h-4" />}
                      </div>
                      <div>
                        <h4 className="text-xs font-medium text-slate-900 dark:text-white">{activity.title}</h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{activity.time}</p>
                      </div>
                    </div>`;

code = code.replace(target, replacement);
fs.writeFileSync('src/pages/Dashboard.tsx', code);
